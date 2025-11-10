// AffiliateManager.ts
// 어필리에이트 시스템 관리 서비스

import { session } from 'electron';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { networkInterfaces } from 'os';

export interface AffiliateInfo {
  trackingCode: string;
  trackingUrl: string;
  commissionRate: number;
}

export interface ReferralStats {
  totalReferrals: number;
  activeSubscriptions: number;
  thisMonthRevenue: number;
  totalRevenue: number;
}

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class AffiliateManager {
  private supabase: SupabaseClient;
  private baseUrl: string = 'https://pixelbooster.com'; // MVP: 실제 도메인 설정

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  }

  /**
   * 추적 링크 생성 (신규 파트너 등록 또는 기존 링크 조회)
   */
  async createTrackingLink(userId: string): Promise<Result<AffiliateInfo>> {
    try {
      // 1. 기존 어필리에이트 확인
      const { data: existingAffiliate, error: queryError } = await this.supabase
        .from('affiliates')
        .select('tracking_code, commission_rate')
        .eq('user_id', userId)
        .single();

      if (existingAffiliate && !queryError) {
        // 이미 파트너인 경우
        return {
          success: true,
          data: {
            trackingCode: existingAffiliate.tracking_code,
            trackingUrl: `${this.baseUrl}?ref=${existingAffiliate.tracking_code}`,
            commissionRate: existingAffiliate.commission_rate
          }
        };
      }

      // 2. 신규 파트너 등록
      const trackingCode = this.generateTrackingCode();

      const { data: newAffiliate, error: insertError } = await this.supabase
        .from('affiliates')
        .insert({
          user_id: userId,
          tracking_code: trackingCode,
          commission_rate: 30.0 // 기본 수수료율 30%
        })
        .select('tracking_code, commission_rate')
        .single();

      if (insertError || !newAffiliate) {
        return {
          success: false,
          error: insertError?.message || 'Failed to create tracking link'
        };
      }

      return {
        success: true,
        data: {
          trackingCode: newAffiliate.tracking_code,
          trackingUrl: `${this.baseUrl}?ref=${newAffiliate.tracking_code}`,
          commissionRate: newAffiliate.commission_rate
        }
      };
    } catch (error) {
      console.error('[AffiliateManager] createTrackingLink error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 어필리에이트 링크 클릭 시 쿠키 저장
   */
  async trackReferral(trackingCode: string): Promise<Result<void>> {
    try {
      // 1. 서버에 추적 요청
      const { data, error } = await this.supabase.functions.invoke('track-referral', {
        body: {
          trackingCode,
          userAgent: 'PixelBooster/1.0.0 (Electron)',
          ipAddress: await this.getLocalIP()
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // 2. 로컬 쿠키 저장 (3일 유효)
      const expirationDate = new Date(data.expiresAt).getTime() / 1000;

      await session.defaultSession.cookies.set({
        url: this.baseUrl,
        name: 'ref_code',
        value: trackingCode,
        expirationDate,
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
      });

      console.log('[AffiliateManager] Referral tracked:', trackingCode);

      return {
        success: true
      };
    } catch (error) {
      console.error('[AffiliateManager] trackReferral error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 회원가입 시 추천 연결
   */
  async linkReferralToUser(userId: string, subscriptionId: string): Promise<Result<void>> {
    try {
      // 1. 쿠키에서 tracking_code 조회
      const cookies = await session.defaultSession.cookies.get({
        url: this.baseUrl,
        name: 'ref_code'
      });

      if (cookies.length === 0) {
        console.log('[AffiliateManager] No referral cookie found');
        return {
          success: true // 쿠키 없음은 정상 (어필리에이트 없는 가입)
        };
      }

      const trackingCode = cookies[0].value;

      // 2. tracking_code로 affiliate_id 조회
      const { data: affiliate, error: affiliateError } = await this.supabase
        .from('affiliates')
        .select('id')
        .eq('tracking_code', trackingCode)
        .single();

      if (affiliateError || !affiliate) {
        console.warn('[AffiliateManager] Invalid tracking code:', trackingCode);
        return {
          success: false,
          error: 'Invalid tracking code'
        };
      }

      // 3. affiliate_referrals 테이블에 삽입
      const { error: referralError } = await this.supabase
        .from('affiliate_referrals')
        .insert({
          affiliate_id: affiliate.id,
          referred_user_id: userId,
          subscription_id: subscriptionId
        });

      if (referralError) {
        console.error('[AffiliateManager] Error creating referral:', referralError);
        return {
          success: false,
          error: referralError.message
        };
      }

      // 4. 쿠키 삭제 (일회성)
      await session.defaultSession.cookies.remove(this.baseUrl, 'ref_code');

      console.log('[AffiliateManager] Referral linked successfully');

      return {
        success: true
      };
    } catch (error) {
      console.error('[AffiliateManager] linkReferralToUser error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 어필리에이트 통계 조회
   */
  async getReferralStats(userId: string): Promise<Result<ReferralStats>> {
    try {
      // 1. affiliate_id 조회
      const { data: affiliate, error: affiliateError } = await this.supabase
        .from('affiliates')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (affiliateError || !affiliate) {
        return {
          success: false,
          error: 'Affiliate not found'
        };
      }

      // 2. 총 추천 수
      const { count: totalReferrals, error: totalError } = await this.supabase
        .from('affiliate_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', affiliate.id);

      // 3. 활성 구독자 수 (만료되지 않은 구독)
      const { count: activeSubscriptions, error: activeError } = await this.supabase
        .from('affiliate_referrals')
        .select('subscription_id, subscriptions!inner(status)', { count: 'exact', head: true })
        .eq('affiliate_id', affiliate.id)
        .eq('subscriptions.status', 'active');

      // 4. 이번 달 수익
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const { data: thisMonthRevenue, error: monthError } = await this.supabase
        .from('revenue_logs')
        .select('commission_amount')
        .eq('affiliate_id', affiliate.id)
        .gte('created_at', thisMonthStart.toISOString());

      // 5. 총 누적 수익
      const { data: totalRevenue, error: totalRevenueError } = await this.supabase
        .from('revenue_logs')
        .select('commission_amount')
        .eq('affiliate_id', affiliate.id);

      if (totalError || activeError || monthError || totalRevenueError) {
        return {
          success: false,
          error: 'Failed to fetch stats'
        };
      }

      // 수익 합계 계산
      const thisMonth = thisMonthRevenue?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;
      const total = totalRevenue?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;

      return {
        success: true,
        data: {
          totalReferrals: totalReferrals || 0,
          activeSubscriptions: activeSubscriptions || 0,
          thisMonthRevenue: thisMonth,
          totalRevenue: total
        }
      };
    } catch (error) {
      console.error('[AffiliateManager] getReferralStats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 8자 랜덤 추적 코드 생성
   */
  private generateTrackingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 로컬 IP 주소 조회
   */
  private async getLocalIP(): Promise<string> {
    try {
      const nets = networkInterfaces();
      for (const name of Object.keys(nets)) {
        const netInfo = nets[name];
        if (!netInfo) continue;

        for (const net of netInfo) {
          // IPv4이고, 내부 네트워크가 아닌 주소
          if (net.family === 'IPv4' && !net.internal) {
            return net.address;
          }
        }
      }
      return '127.0.0.1';
    } catch (error) {
      console.error('[AffiliateManager] getLocalIP error:', error);
      return '127.0.0.1';
    }
  }
}
