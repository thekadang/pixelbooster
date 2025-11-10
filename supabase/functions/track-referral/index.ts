// track-referral Edge Function
// 어필리에이트 링크 클릭 시 쿠키 추적 로직

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface TrackReferralRequest {
  trackingCode: string;
  userAgent?: string;
  ipAddress?: string;
}

interface TrackReferralResponse {
  success: boolean;
  message?: string;
  expiresAt?: string;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  // CORS 헤더
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // OPTIONS 요청 처리 (CORS Preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    // 1. 요청 본문 파싱
    const body: TrackReferralRequest = await req.json();
    const { trackingCode, userAgent, ipAddress } = body;

    // 유효성 검사
    if (!trackingCode || trackingCode.trim() === '') {
      const response: TrackReferralResponse = {
        success: false,
        error: 'Tracking code is required'
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers
      });
    }

    // 2. Supabase 클라이언트 초기화
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. tracking_code로 affiliate 조회
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id')
      .eq('tracking_code', trackingCode)
      .single();

    if (affiliateError || !affiliate) {
      const response: TrackReferralResponse = {
        success: false,
        error: 'Invalid tracking code'
      };
      return new Response(JSON.stringify(response), {
        status: 404,
        headers
      });
    }

    // 4. 쿠키 만료 시간 계산 (3일)
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // 5. user_events 테이블에 방문 기록
    const { error: eventError } = await supabase
      .from('user_events')
      .insert({
        user_id: null,
        event_type: 'affiliate_click',
        event_data: {
          affiliate_id: affiliate.id,
          tracking_code: trackingCode,
          expires_at: expiresAt.toISOString()
        },
        ip_address: ipAddress || null,
        user_agent: userAgent || null
      });

    if (eventError) {
      console.error('[track-referral] Error inserting event:', eventError);
      const response: TrackReferralResponse = {
        success: false,
        error: 'Failed to track referral'
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers
      });
    }

    // 6. 성공 응답
    const response: TrackReferralResponse = {
      success: true,
      message: 'Referral tracked successfully',
      expiresAt: expiresAt.toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('[track-referral] Unexpected error:', error);
    const response: TrackReferralResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers
    });
  }
});
