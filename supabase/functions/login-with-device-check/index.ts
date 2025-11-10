// supabase/functions/login-with-device-check/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 개발 중에는 '*', 프로덕션에서는 특정 origin으로 제한
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * login-with-device-check Edge Function
 *
 * 기능:
 * 1. 사용자 인증 (이메일 + 비밀번호)
 * 2. 구독 등급 조회
 * 3. 등급별 기기 한도 확인
 * 4. 기존 기기 확인
 * 5. 새 기기 등록 (한도 내)
 * 6. JWT 토큰 반환
 */
serve(async (req) => {
  // CORS Preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Supabase 클라이언트 생성 (service_role 키 사용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 요청 데이터 파싱
    const { email, password, deviceId, deviceName } = await req.json();

    console.log('[login-with-device-check] Request:', { email, deviceId, deviceName });

    // 1. 입력 검증
    if (!email || !password || !deviceId) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          message: '이메일, 비밀번호, 기기 ID는 필수입니다.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. 사용자 인증
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('[login-with-device-check] Auth error:', authError);

      return new Response(
        JSON.stringify({
          error: 'Authentication failed',
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
          details: authError.message,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = authData.user.id;
    console.log('[login-with-device-check] User authenticated:', userId);

    // 3. 구독 등급 조회
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('tier, status, expires_at')
      .eq('user_id', userId)
      .single();

    if (subError) {
      console.error('[login-with-device-check] Subscription error:', subError);
    }

    const tier = subscription?.tier || 'free';
    console.log('[login-with-device-check] User tier:', tier);

    // 4. 등급별 기기 한도
    const deviceLimits: Record<string, number> = {
      free: 1,
      basic: 2,
      pro: 5,
    };
    const maxDevices = deviceLimits[tier] || 1;

    // 5. 기존 기기 확인
    const { data: existingDevice } = await supabase
      .from('registered_devices')
      .select('id, device_name, created_at')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .single();

    if (existingDevice) {
      // 기존 기기 - 로그인 허용
      console.log('[login-with-device-check] Existing device:', existingDevice.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: '로그인 성공',
          token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          user: authData.user,
          subscription: {
            tier,
            status: subscription?.status || 'free',
            expires_at: subscription?.expires_at || null,
          },
          device: {
            isNew: false,
            deviceId: existingDevice.id,
            deviceName: existingDevice.device_name,
            registeredAt: existingDevice.created_at,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. 새 기기 - 한도 확인
    const { count: deviceCount } = await supabase
      .from('registered_devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (deviceCount !== null && deviceCount >= maxDevices) {
      console.log('[login-with-device-check] Device limit exceeded:', {
        current: deviceCount,
        max: maxDevices,
      });

      // 한도 초과 - 로그인 거부
      return new Response(
        JSON.stringify({
          error: 'Device limit exceeded',
          message: `기기 한도 초과: ${tier} 플랜은 최대 ${maxDevices}대까지 등록 가능합니다.`,
          details: {
            tier,
            maxDevices,
            currentDevices: deviceCount,
          },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 7. 새 기기 등록
    const { data: newDevice, error: deviceError } = await supabase
      .from('registered_devices')
      .insert({
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName || 'Unknown Device',
      })
      .select()
      .single();

    if (deviceError) {
      console.error('[login-with-device-check] Device registration error:', deviceError);

      return new Response(
        JSON.stringify({
          error: 'Device registration failed',
          message: '기기 등록에 실패했습니다.',
          details: deviceError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[login-with-device-check] New device registered:', newDevice.id);

    // 8. 성공 응답
    return new Response(
      JSON.stringify({
        success: true,
        message: '로그인 성공 (새 기기 등록)',
        token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        user: authData.user,
        subscription: {
          tier,
          status: subscription?.status || 'free',
          expires_at: subscription?.expires_at || null,
        },
        device: {
          isNew: true,
          deviceId: newDevice.id,
          deviceName: newDevice.device_name,
          registeredAt: newDevice.created_at,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[login-with-device-check] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: '서버 오류가 발생했습니다.',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
