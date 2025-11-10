// process-commission Edge Function
// Stripe Webhook으로부터 결제 성공 이벤트 수신 → 수수료 계산 및 revenue_logs 기록

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ProcessCommissionRequest {
  subscriptionId: string;
  amount: number;
  currency: string;
  userId: string;
}

interface ProcessCommissionResponse {
  success: boolean;
  data?: {
    affiliateId: string | null;
    commissionAmount: number;
    commissionRate: number;
  };
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

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    // 1. 요청 본문 파싱
    const body: ProcessCommissionRequest = await req.json();
    const { subscriptionId, amount, currency, userId } = body;

    // 유효성 검사
    if (!subscriptionId || !amount || !userId) {
      const response: ProcessCommissionResponse = {
        success: false,
        error: 'Missing required fields: subscriptionId, amount, userId'
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

    // 3. subscriptions 테이블에서 subscription_id 조회
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (subError || !subscription) {
      console.warn('[process-commission] Subscription not found:', subscriptionId);
      // 어필리에이트 없음 → commission 0으로 기록
      await supabase
        .from('revenue_logs')
        .insert({
          user_id: userId,
          affiliate_id: null,
          amount,
          commission_amount: 0
        });

      const response: ProcessCommissionResponse = {
        success: true,
        data: {
          affiliateId: null,
          commissionAmount: 0,
          commissionRate: 0
        }
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers
      });
    }

    // 4. affiliate_referrals에서 추천 기록 조회
    const { data: referral, error: refError } = await supabase
      .from('affiliate_referrals')
      .select('affiliate_id, affiliates(commission_rate)')
      .eq('subscription_id', subscription.id)
      .single();

    if (refError || !referral) {
      console.warn('[process-commission] No referral found for subscription:', subscription.id);
      // 어필리에이트 없음 → commission 0으로 기록
      await supabase
        .from('revenue_logs')
        .insert({
          user_id: userId,
          affiliate_id: null,
          amount,
          commission_amount: 0
        });

      const response: ProcessCommissionResponse = {
        success: true,
        data: {
          affiliateId: null,
          commissionAmount: 0,
          commissionRate: 0
        }
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers
      });
    }

    // 5. 수수료 계산
    const commissionRate = (referral.affiliates as any).commission_rate;
    const commissionAmount = amount * (commissionRate / 100);

    // 6. revenue_logs 테이블에 기록
    const { error: logError } = await supabase
      .from('revenue_logs')
      .insert({
        user_id: userId,
        affiliate_id: referral.affiliate_id,
        amount,
        commission_amount: commissionAmount
      });

    if (logError) {
      console.error('[process-commission] Error inserting revenue log:', logError);
      const response: ProcessCommissionResponse = {
        success: false,
        error: 'Failed to record commission'
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers
      });
    }

    // 7. 성공 응답
    const response: ProcessCommissionResponse = {
      success: true,
      data: {
        affiliateId: referral.affiliate_id,
        commissionAmount,
        commissionRate
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('[process-commission] Unexpected error:', error);
    const response: ProcessCommissionResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers
    });
  }
});
