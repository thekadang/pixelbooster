# Edge Function 수동 배포 가이드 (Supabase 대시보드)

CLI 없이 Supabase 웹 대시보드에서 직접 Edge Function을 배포하는 방법입니다.

---

## 📋 배포 단계

### 1단계: Supabase 대시보드 접속

1. https://supabase.com/dashboard 접속
2. 로그인
3. 프로젝트 선택 (thekadang_pixelbooster)

### 2단계: Edge Functions 메뉴 이동

1. 왼쪽 메뉴에서 **"Edge Functions"** 클릭
2. **"Create a new function"** 버튼 클릭

### 3단계: 함수 생성

**함수 이름**: `login-with-device-check`

**코드 붙여넣기**:

```typescript
// supabase/functions/login-with-device-check/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
```

### 4단계: 함수 배포

1. 코드를 붙여넣은 후 **"Deploy function"** 버튼 클릭
2. 배포 완료까지 대기 (1-2분)

### 5단계: 배포 확인

배포가 완료되면 함수 URL이 표시됩니다:

```
https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/login-with-device-check
```

### 6단계: 환경 변수 자동 설정

Supabase는 다음 환경 변수를 자동으로 설정합니다:
- `SUPABASE_URL`: 자동 설정됨
- `SUPABASE_SERVICE_ROLE_KEY`: 자동 설정됨

추가 설정이 필요하지 않습니다!

---

## ✅ 테스트

### cURL을 사용한 테스트

```bash
curl -i --location --request POST \
  'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/login-with-device-check' \
  --header 'Authorization: Bearer <YOUR_ANON_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "password": "password123",
    "deviceId": "test-device-abc",
    "deviceName": "Test Device"
  }'
```

### Postman을 사용한 테스트

1. **Method**: POST
2. **URL**: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/login-with-device-check`
3. **Headers**:
   - `Authorization`: `Bearer <YOUR_ANON_KEY>`
   - `Content-Type`: `application/json`
4. **Body** (raw JSON):
   ```json
   {
     "email": "test@example.com",
     "password": "password123",
     "deviceId": "test-device-abc",
     "deviceName": "Test Device"
   }
   ```

---

## 📊 로그 확인

### 대시보드에서 로그 확인

1. Edge Functions 페이지에서 `login-with-device-check` 함수 클릭
2. **"Logs"** 탭 클릭
3. 실시간 로그 확인

### 로그 예시

**성공 (기존 기기)**:
```
[login-with-device-check] Request: { email: 'user@example.com', deviceId: 'abc...', deviceName: 'MacBook Pro' }
[login-with-device-check] User authenticated: 123...
[login-with-device-check] User tier: basic
[login-with-device-check] Existing device: 456...
```

**실패 (기기 한도 초과)**:
```
[login-with-device-check] Request: { email: 'user@example.com', deviceId: 'xyz...', deviceName: 'Windows PC' }
[login-with-device-check] User authenticated: 123...
[login-with-device-check] User tier: free
[login-with-device-check] Device limit exceeded: { current: 1, max: 1 }
```

---

## 🔧 문제 해결

### 문제 1: "Missing required fields" 에러

**원인**: 요청 body에 필수 필드가 누락됨

**해결**: email, password, deviceId가 모두 포함되어 있는지 확인

### 문제 2: "Authentication failed" 에러

**원인**: 이메일 또는 비밀번호가 올바르지 않음

**해결**:
- Supabase Auth 대시보드에서 사용자 확인
- 이메일 인증 완료 여부 확인

### 문제 3: CORS 에러

**원인**: CORS 헤더 설정 문제

**해결**:
- 코드에서 `corsHeaders`가 모든 응답에 포함되는지 확인
- 브라우저 콘솔에서 정확한 오류 확인

---

## 📝 다음 단계

1. ✅ Edge Function 배포 완료
2. 🔄 클라이언트 앱에서 테스트
3. 🚀 프로덕션 배포

---

**작성일**: 2025-11-10
**담당자**: 백엔드 개발자
