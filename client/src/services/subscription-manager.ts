/**
 * SubscriptionManager - 구독 등급 관리 서비스
 *
 * 역할:
 * - 구독 등급 조회 및 캐싱
 * - 등급별 기능 제한 확인
 * - 만료 체크
 * - 서버와 동기화
 *
 * 등급:
 * - Free: WebP만, 10개/배치
 * - Basic: WebP + AVIF, 50개/배치
 * - Pro: 모든 포맷, 200개/배치
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { secureStorage } from './secure-storage';

// Result 타입 패턴
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// 구독 등급 타입
type SubscriptionTier = 'free' | 'basic' | 'pro';

// 이미지 포맷 타입
type ImageFormat = 'webp' | 'avif' | 'jpg' | 'png' | 'gif' | 'bmp' | 'tiff';

// 구독 정보 인터페이스
interface SubscriptionInfo {
  userId: string;
  tier: SubscriptionTier;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  expiresAt: string | null;
  features: {
    formats: ImageFormat[];
    maxBatchSize: number;
    maxDevices: number;
    backupEnabled: boolean;
    logEnabled: boolean;
  };
}

// 등급별 기능 정의
const TIER_FEATURES: Record<SubscriptionTier, SubscriptionInfo['features']> = {
  free: {
    formats: ['webp'],
    maxBatchSize: 10,
    maxDevices: 1,
    backupEnabled: false,
    logEnabled: false,
  },
  basic: {
    formats: ['webp', 'avif'],
    maxBatchSize: 50,
    maxDevices: 2,
    backupEnabled: true,
    logEnabled: true,
  },
  pro: {
    formats: ['webp', 'avif', 'jpg', 'png', 'gif', 'bmp', 'tiff'],
    maxBatchSize: 200,
    maxDevices: 5,
    backupEnabled: true,
    logEnabled: true,
  },
};

/**
 * SubscriptionManager 클래스
 * Singleton 패턴으로 구현
 */
class SubscriptionManager {
  private supabase: SupabaseClient;
  private currentSubscription: SubscriptionInfo | null = null;
  private cacheValidUntil: Date | null = null;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 캐시 로드 시도
    this.loadCachedSubscription();
  }

  /**
   * 캐시된 구독 정보 로드
   */
  private loadCachedSubscription(): void {
    try {
      const cached = secureStorage.getSubscriptionCache();

      if (cached) {
        this.currentSubscription = {
          userId: secureStorage.getUserId() || '',
          tier: cached.tier as SubscriptionTier,
          status: 'active',
          expiresAt: cached.expires_at,
          features: TIER_FEATURES[cached.tier as SubscriptionTier],
        };

        this.cacheValidUntil = new Date(Date.now() + this.CACHE_TTL_MS);
        console.log('캐시된 구독 정보 로드:', cached.tier);
      }
    } catch (error) {
      console.error('구독 캐시 로드 실패:', error);
    }
  }

  /**
   * 구독 정보 조회 (캐시 우선)
   *
   * @param userId - 사용자 ID
   * @param forceRefresh - 강제 갱신 여부
   * @returns Result<SubscriptionInfo>
   */
  public async getSubscription(
    userId: string,
    forceRefresh = false
  ): Promise<Result<SubscriptionInfo>> {
    try {
      // 캐시 확인
      if (
        !forceRefresh &&
        this.currentSubscription &&
        this.cacheValidUntil &&
        new Date() < this.cacheValidUntil &&
        this.currentSubscription.userId === userId
      ) {
        console.log('캐시된 구독 정보 반환:', this.currentSubscription.tier);
        return { success: true, data: this.currentSubscription };
      }

      // 서버에서 조회
      const { data, error } = await this.supabase
        .from('subscriptions')
        .select('tier, status, expires_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        // 구독 정보가 없으면 Free 등급으로 간주
        if (error.code === 'PGRST116') {
          const freeSubscription: SubscriptionInfo = {
            userId,
            tier: 'free',
            status: 'active',
            expiresAt: null,
            features: TIER_FEATURES.free,
          };

          this.updateCache(freeSubscription);
          return { success: true, data: freeSubscription };
        }

        return { success: false, error: `구독 조회 실패: ${error.message}` };
      }

      // 만료 체크
      const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
      const subscription: SubscriptionInfo = {
        userId,
        tier: isExpired ? 'free' : (data.tier as SubscriptionTier),
        status: isExpired ? 'expired' : (data.status as SubscriptionInfo['status']),
        expiresAt: data.expires_at,
        features: TIER_FEATURES[isExpired ? 'free' : (data.tier as SubscriptionTier)],
      };

      // 캐시 업데이트
      this.updateCache(subscription);

      console.log('서버에서 구독 정보 조회:', subscription.tier);
      return { success: true, data: subscription };
    } catch (error: any) {
      console.error('구독 조회 에러:', error);
      return { success: false, error: `구독 조회 실패: ${error.message}` };
    }
  }

  /**
   * 캐시 업데이트
   */
  private updateCache(subscription: SubscriptionInfo): void {
    this.currentSubscription = subscription;
    this.cacheValidUntil = new Date(Date.now() + this.CACHE_TTL_MS);

    // SecureStorage에 저장
    secureStorage.setSubscriptionCache(
      subscription.tier,
      subscription.expiresAt || ''
    );
  }

  /**
   * 캐시 무효화
   */
  public invalidateCache(): void {
    this.currentSubscription = null;
    this.cacheValidUntil = null;
    secureStorage.clearSubscriptionCache();
    console.log('구독 캐시 무효화 완료');
  }

  /**
   * 포맷 지원 여부 확인
   *
   * @param format - 이미지 포맷
   * @param userId - 사용자 ID
   * @returns Result<boolean>
   */
  public async isFormatSupported(
    format: ImageFormat,
    userId: string
  ): Promise<Result<boolean>> {
    const result = await this.getSubscription(userId);

    if (!result.success) {
      return result;
    }

    const isSupported = result.data.features.formats.includes(format);
    return { success: true, data: isSupported };
  }

  /**
   * 배치 크기 검증
   *
   * @param batchSize - 요청한 배치 크기
   * @param userId - 사용자 ID
   * @returns Result<boolean>
   */
  public async validateBatchSize(
    batchSize: number,
    userId: string
  ): Promise<Result<boolean>> {
    const result = await this.getSubscription(userId);

    if (!result.success) {
      return result;
    }

    const isValid = batchSize <= result.data.features.maxBatchSize;

    if (!isValid) {
      return {
        success: false,
        error: `배치 크기가 ${result.data.features.maxBatchSize}개를 초과합니다. (현재: ${batchSize}개)`,
      };
    }

    return { success: true, data: true };
  }

  /**
   * 기능 사용 가능 여부 확인
   *
   * @param feature - 기능 이름
   * @param userId - 사용자 ID
   * @returns Result<boolean>
   */
  public async isFeatureEnabled(
    feature: 'backup' | 'log',
    userId: string
  ): Promise<Result<boolean>> {
    const result = await this.getSubscription(userId);

    if (!result.success) {
      return result;
    }

    const featureKey = feature === 'backup' ? 'backupEnabled' : 'logEnabled';
    const isEnabled = result.data.features[featureKey];

    return { success: true, data: isEnabled };
  }

  /**
   * 현재 구독 등급 반환 (캐시에서)
   */
  public getCurrentTier(): SubscriptionTier {
    return this.currentSubscription?.tier || 'free';
  }

  /**
   * 만료일 반환
   */
  public getExpiresAt(): string | null {
    return this.currentSubscription?.expiresAt || null;
  }

  /**
   * 만료 여부 확인
   */
  public isExpired(): boolean {
    const expiresAt = this.getExpiresAt();

    if (!expiresAt) {
      return false; // 만료일이 없으면 만료 안 됨 (Free 등급)
    }

    return new Date(expiresAt) < new Date();
  }

  /**
   * 남은 일수 계산
   */
  public getDaysRemaining(): number | null {
    const expiresAt = this.getExpiresAt();

    if (!expiresAt) {
      return null; // 만료일이 없음
    }

    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }

  /**
   * 업그레이드 가능한 등급 목록 반환
   */
  public getUpgradableTiers(): SubscriptionTier[] {
    const currentTier = this.getCurrentTier();

    const tiers: SubscriptionTier[] = ['free', 'basic', 'pro'];
    const currentIndex = tiers.indexOf(currentTier);

    return tiers.slice(currentIndex + 1);
  }

  /**
   * 등급 비교
   */
  public compareTiers(tierA: SubscriptionTier, tierB: SubscriptionTier): number {
    const tiers: SubscriptionTier[] = ['free', 'basic', 'pro'];
    return tiers.indexOf(tierA) - tiers.indexOf(tierB);
  }

  /**
   * 등급별 기능 정보 반환
   */
  public getTierFeatures(tier: SubscriptionTier): SubscriptionInfo['features'] {
    return TIER_FEATURES[tier];
  }
}

// Singleton 인스턴스 생성 및 export
export const subscriptionManager = new SubscriptionManager();
export default subscriptionManager;
