# 보안 아키텍처 및 어뷰징 방지

더카당 픽셀부스터의 보안 설계, 위협 모델, 어뷰징 방지 전략을 정의합니다.

---

## 목차
1. [위협 모델 (Threat Model)](#위협-모델-threat-model)
2. [Electron 앱 보안](#electron-앱-보안)
3. [API 보안](#api-보안)
4. [데이터 암호화](#데이터-암호화)
5. [어뷰징 방지 전략](#어뷰징-방지-전략)
6. [결제 보안](#결제-보안)
7. [보안 체크리스트](#보안-체크리스트)

---

## 위협 모델 (Threat Model)

### 공격 시나리오 분석

#### 1. 클라이언트 앱 역공학 (Reverse Engineering)
**위협**: Electron 앱은 JavaScript로 작성되어 디컴파일이 쉬움
- API 키 추출
- 비즈니스 로직 복제
- 라이선스 우회

**대응책**:
- ✅ Supabase anon key만 클라이언트에 포함 (공개 가능)
- ✅ service_role key는 서버(Edge Functions)에만 존재
- ✅ 코드 난독화 (webpack-obfuscator)
- ✅ 중요 로직은 서버에서 검증

#### 2. 구독 등급 조작 (Subscription Bypass)
**위협**: 클라이언트가 구독 등급을 조작하여 Pro 기능 사용
- 로컬 저장소 수정
- 네트워크 응답 조작

**대응책**:
- ✅ 서버에서만 구독 정보 관리
- ✅ RLS (Row Level Security)로 DB 레벨 보호
- ✅ 기능 실행 전 서버에서 재검증

#### 3. 계정 공유 (Account Sharing)
**위협**: 한 Pro 계정을 여러 사용자가 공유
- 수익 손실
- 서버 부하 증가

**대응책**:
- ✅ 기기 등록 수 제한 (Free 1대, Basic 2대, Pro 5대)
- ✅ 기기 ID 검증
- ✅ 의심스러운 패턴 감지

#### 4. API 남용 (API Abuse)
**위협**: 무한 API 호출로 서버 부하 및 비용 증가
- DDoS 공격
- 크롤링

**대응책**:
- ✅ Rate Limiting
- ✅ IP/User 기반 제한
- ✅ 비정상 패턴 탐지

#### 5. 결제 조작 (Payment Fraud)
**위협**: 가짜 결제 Webhook으로 무료 구독 활성화
- Webhook 위조
- 가격 조작

**대응책**:
- ✅ Webhook 서명 검증
- ✅ 서버에서만 가격 정보 관리
- ✅ Stripe/Paddle의 검증 메커니즘 활용

---

## Electron 앱 보안

### 1. API 키 보호

#### 안전한 방법
```javascript
// ✅ 클라이언트에 포함 가능 (공개 키)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY  // anon key는 RLS로 보호됨
);
```

#### 위험한 방법
```javascript
// ❌ 절대 금지! service_role key는 클라이언트에 포함 금지
const supabase = createClient(
  url,
  'SERVICE_ROLE_KEY'  // 전체 DB 접근 가능 - 위험!
);
```

### 2. 코드 난독화

#### webpack 설정
```javascript
// webpack.config.js
const WebpackObfuscator = require('webpack-obfuscator');

module.exports = {
  // ... 기본 설정
  plugins: [
    new WebpackObfuscator({
      rotateStringArray: true,
      stringArray: true,
      stringArrayThreshold: 0.75,
      // 디버깅 어려움 증가
      debugProtection: true,
      debugProtectionInterval: 2000,
      // 변수명 난독화
      identifierNamesGenerator: 'hexadecimal',
      // 성능 유지
      compact: true,
      simplify: true
    }, ['excluded_bundle_name.js'])
  ]
};
```

### 3. 민감 데이터 로컬 저장

#### 안전한 저장 방법
```typescript
// client/src/services/SecureStorage.ts
import Store from 'electron-store';
import { machineIdSync } from 'node-machine-id';

class SecureStorage {
  private store: Store;

  constructor() {
    // 기기 고유값을 암호화 키로 사용
    const machineId = machineIdSync(true);

    this.store = new Store({
      encryptionKey: machineId,
      name: 'secure-data'
    });
  }

  // JWT 토큰 저장
  setAuthToken(token: string) {
    this.store.set('auth_token', token);
  }

  getAuthToken(): string | null {
    return this.store.get('auth_token') as string || null;
  }

  // 기기 ID 저장
  setDeviceId(deviceId: string) {
    this.store.set('device_id', deviceId);
  }

  getDeviceId(): string | null {
    return this.store.get('device_id') as string || null;
  }

  // 로그아웃 시 삭제
  clear() {
    this.store.clear();
  }
}

export default new SecureStorage();
```

### 4. IPC 보안

```typescript
// Main Process
import { ipcMain } from 'electron';

// ✅ 허용 목록 기반 IPC 채널
const ALLOWED_CHANNELS = [
  'convert-image',
  'check-subscription',
  'login',
  'logout'
];

ipcMain.handle('message', async (event, channel, ...args) => {
  if (!ALLOWED_CHANNELS.includes(channel)) {
    console.error(`Unauthorized IPC channel: ${channel}`);
    return { error: 'Unauthorized' };
  }

  // 채널별 처리
  switch (channel) {
    case 'convert-image':
      return await handleImageConversion(...args);
    case 'check-subscription':
      return await checkSubscription();
    // ...
  }
});
```

---

## API 보안

### 1. Rate Limiting (속도 제한)

#### Supabase Edge Function 구현
```typescript
// server/supabase/functions/_shared/rate-limiter.ts
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const rateLimits: Record<string, RateLimitConfig> = {
  'login': { maxRequests: 5, windowMs: 60000 },        // 5회/분
  'check-subscription': { maxRequests: 60, windowMs: 60000 },  // 60회/분
  'register-device': { maxRequests: 3, windowMs: 3600000 },    // 3회/시간
  'convert-request': { maxRequests: 100, windowMs: 60000 }     // 100회/분
};

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  canProceed(key: string, endpoint: string): boolean {
    const config = rateLimits[endpoint];
    if (!config) return true; // 제한 없음

    const now = Date.now();
    const requestKey = `${key}:${endpoint}`;

    // 기존 요청 기록 가져오기
    let timestamps = this.requests.get(requestKey) || [];

    // 시간 윈도우 밖의 요청 제거
    timestamps = timestamps.filter(t => now - t < config.windowMs);

    // 한도 확인
    if (timestamps.length >= config.maxRequests) {
      return false; // 제한 초과
    }

    // 현재 요청 기록
    timestamps.push(now);
    this.requests.set(requestKey, timestamps);

    return true;
  }
}

const limiter = new RateLimiter();

export function checkRateLimit(userId: string, endpoint: string): boolean {
  return limiter.canProceed(userId, endpoint);
}
```

#### Edge Function에서 사용
```typescript
// server/supabase/functions/login-with-device-check/index.ts
import { checkRateLimit } from '../_shared/rate-limiter.ts';

Deno.serve(async (req) => {
  const { email } = await req.json();

  // Rate Limiting 체크
  if (!checkRateLimit(email, 'login')) {
    return new Response(
      JSON.stringify({ error: 'Too many login attempts. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 로그인 처리
  // ...
});
```

### 2. 이메일 인증

#### 회원가입 시 이메일 확인 활성화
```typescript
// Supabase 대시보드 설정
// Authentication > Settings > Email Auth
// ✅ Enable email confirmations

// 클라이언트 코드
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    emailRedirectTo: 'pixelbooster://email-confirmed'
  }
});

// 이메일 확인 전까지 로그인 불가
```

#### 일회용 이메일 차단
```typescript
// server/supabase/functions/check-disposable-email/index.ts
import { disposableDomains } from './disposable-domains.ts';  // 일회용 도메인 목록

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1].toLowerCase();
  return disposableDomains.includes(domain);
}

// 회원가입 시 확인
if (isDisposableEmail(email)) {
  return new Response(
    JSON.stringify({ error: 'Disposable email addresses are not allowed' }),
    { status: 400 }
  );
}
```

### 3. CORS 설정

```typescript
// Supabase Edge Function
const corsHeaders = {
  'Access-Control-Allow-Origin': 'pixelbooster://*',  // Electron 앱만 허용
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // OPTIONS 요청 처리 (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 실제 요청 처리
  const response = await handleRequest(req);

  // CORS 헤더 추가
  return new Response(response.body, {
    ...response,
    headers: { ...response.headers, ...corsHeaders }
  });
});
```

---

## 데이터 암호화

### 1. 전송 중 암호화 (In-Transit)

```
✅ 모든 통신은 HTTPS/TLS 1.3
✅ Supabase가 기본 제공
✅ Certificate Pinning (선택사항, 고급 보안)
```

### 2. 저장 시 암호화 (At-Rest)

#### 데이터베이스
```sql
-- Supabase PostgreSQL은 기본적으로 암호화됨
-- 추가 암호화가 필요한 민감 데이터:

-- pgcrypto 확장 활성화
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 민감한 데이터 암호화 저장 예시
CREATE TABLE sensitive_data (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  encrypted_data TEXT,  -- pgp_sym_encrypt로 암호화된 데이터
  created_at TIMESTAMP DEFAULT NOW()
);

-- 삽입 시 암호화
INSERT INTO sensitive_data (user_id, encrypted_data) VALUES
  ('user-id', pgp_sym_encrypt('민감한 정보', 'encryption-key'));

-- 조회 시 복호화
SELECT pgp_sym_decrypt(encrypted_data::bytea, 'encryption-key')
FROM sensitive_data WHERE user_id = 'user-id';
```

#### 로컬 파일
```typescript
// 사용자 설정, 토큰 등은 electron-store로 자동 암호화
// (위의 SecureStorage 클래스 참조)
```

### 3. 비밀번호 해싱

```
✅ Supabase Auth가 bcrypt로 자동 해싱
✅ 평문 비밀번호는 DB에 저장 안 됨
✅ Salt는 자동 생성
```

---

## 어뷰징 방지 전략

### 1. 기기 등록 수 제한

#### 기기 ID 생성 (견고한 방법)
```typescript
// client/src/services/DeviceManager.ts
import { machineIdSync } from 'node-machine-id';
import { networkInterfaces } from 'os';
import crypto from 'crypto';

class DeviceManager {
  generateDeviceId(): string {
    // 1. 하드웨어 시리얼 번호
    const machineId = machineIdSync(true);

    // 2. MAC 주소 (첫 번째 네트워크 인터페이스)
    const nets = networkInterfaces();
    const mac = Object.values(nets)
      .flat()
      .find(net => net && !net.internal && net.mac !== '00:00:00:00:00:00')
      ?.mac || 'unknown';

    // 3. OS 정보
    const os = `${process.platform}-${process.arch}`;

    // 조합하여 해시
    const combined = `${machineId}-${mac}-${os}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');

    return hash;
  }

  async registerDevice(userId: string, deviceId: string, deviceName: string) {
    // 서버 API 호출
    const response = await fetch(`${API_URL}/register-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ userId, deviceId, deviceName })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  }
}
```

#### 서버 측 검증
```typescript
// server/supabase/functions/login-with-device-check/index.ts
Deno.serve(async (req) => {
  const { email, password, deviceId, deviceName } = await req.json();

  // 1. 사용자 인증
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  }

  const userId = authData.user.id;

  // 2. 구독 등급 조회
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .single();

  const tier = subscription?.tier || 'free';

  // 3. 등급별 기기 한도
  const deviceLimits = { free: 1, basic: 2, pro: 5 };
  const maxDevices = deviceLimits[tier];

  // 4. 기존 기기 확인
  const { data: existingDevice } = await supabase
    .from('registered_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .single();

  if (existingDevice) {
    // 기존 기기 - 로그인 허용
    return new Response(JSON.stringify({ success: true, token: authData.session.access_token }));
  }

  // 5. 새 기기 - 한도 확인
  const { count } = await supabase
    .from('registered_devices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count >= maxDevices) {
    return new Response(
      JSON.stringify({
        error: 'Device limit exceeded',
        message: `Your ${tier} plan allows up to ${maxDevices} devices. Please remove a device from your account settings.`
      }),
      { status: 403 }
    );
  }

  // 6. 새 기기 등록
  await supabase
    .from('registered_devices')
    .insert({
      user_id: userId,
      device_id: deviceId,
      device_name: deviceName || 'Unknown Device'
    });

  return new Response(JSON.stringify({ success: true, token: authData.session.access_token }));
});
```

### 2. 비정상 패턴 감지

#### 의심스러운 활동 추적
```sql
-- abuse_prevention 테이블
CREATE TABLE abuse_prevention (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  event_type TEXT,  -- 'multiple_devices', 'rapid_logins', 'api_spam'
  event_data JSONB,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_abuse_user_id ON abuse_prevention(user_id);
CREATE INDEX idx_abuse_created_at ON abuse_prevention(created_at);
```

#### 감지 로직
```typescript
// server/supabase/functions/_shared/abuse-detection.ts
export async function detectAbusePattern(userId: string) {
  const supabase = createClient();

  // 1시간 내 5개 이상의 새 기기 등록 시도
  const { count: recentDevices } = await supabase
    .from('registered_devices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 3600000).toISOString());

  if (recentDevices >= 5) {
    // 어뷰징 기록
    await supabase.from('abuse_prevention').insert({
      user_id: userId,
      event_type: 'multiple_devices',
      event_data: { count: recentDevices, window: '1hour' },
      severity: 'high'
    });

    // 관리자 알림 (선택)
    await notifyAdmin(`User ${userId} registered ${recentDevices} devices in 1 hour`);

    return { isAbuse: true, reason: 'Too many devices' };
  }

  return { isAbuse: false };
}
```

### 3. 계정 복구 남용 방지

```typescript
// 비밀번호 재설정 제한
const RESET_LIMIT = 3;  // 1시간에 3번
const RESET_WINDOW = 3600000;  // 1시간

export function canResetPassword(email: string): boolean {
  // Rate limiting 적용
  return checkRateLimit(email, 'password-reset');
}
```

---

## 결제 보안

### 1. Webhook 서명 검증

```typescript
// server/supabase/functions/webhook-stripe/index.ts
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;

  try {
    // Stripe 서명 검증 (매우 중요!)
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  // 검증된 이벤트만 처리
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object);
      break;
  }

  return new Response('OK', { status: 200 });
});
```

### 2. 가격 조작 방지

```typescript
// ❌ 클라이언트에서 가격 전송 - 위험!
const checkout = await createCheckout({
  tier: 'pro',
  price: 9.99  // 조작 가능!
});

// ✅ 서버에서만 가격 관리
const PRICES = {
  'basic_monthly': 'price_1234567890abcdef',  // Stripe Price ID
  'basic_yearly': 'price_abcdef1234567890',
  'pro_monthly': 'price_xyz123abc456',
  'pro_yearly': 'price_abc456xyz123'
};

// 클라이언트는 tier와 interval만 전송
const checkout = await createCheckout({
  tier: 'pro',
  interval: 'monthly'
});

// 서버가 Price ID 결정
const priceId = PRICES[`${tier}_${interval}`];
```

### 3. 결제 후 즉시 검증

```typescript
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  // 1. Stripe에서 구독 정보 재확인 (Webhook 위조 방지)
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  // 2. 실제 결제 금액 확인
  if (subscription.status !== 'active') {
    console.error('Subscription not active:', subscription.id);
    return;
  }

  // 3. DB 업데이트
  const userId = session.metadata.userId;
  const tier = session.metadata.tier;

  await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      tier: tier,
      status: 'active',
      expires_at: new Date(subscription.current_period_end * 1000),
      stripe_subscription_id: subscription.id
    });
}
```

---

## 보안 체크리스트

### 출시 전 필수 확인사항

#### Electron 앱
- [ ] service_role key가 클라이언트 코드에 없는지 확인
- [ ] 코드 난독화 적용 (production 빌드)
- [ ] 민감 데이터 암호화 (SecureStorage 사용)
- [ ] IPC 채널 화이트리스트 적용
- [ ] DevTools 비활성화 (production)

#### Supabase
- [ ] RLS (Row Level Security) 모든 테이블에 활성화
- [ ] anon key만 클라이언트에서 사용
- [ ] service_role key는 환경 변수로 관리
- [ ] CORS 설정 (허용된 Origin만)
- [ ] API Rate Limiting 설정

#### 인증
- [ ] 이메일 확인 활성화
- [ ] 일회용 이메일 차단
- [ ] 비밀번호 강도 요구사항 설정
- [ ] 2FA (향후 추가 고려)

#### 결제
- [ ] Stripe Webhook 서명 검증
- [ ] 가격 정보 서버에서만 관리
- [ ] 결제 후 Stripe API로 재확인
- [ ] 환불 정책 구현

#### 모니터링
- [ ] 어뷰징 패턴 감지 활성화
- [ ] 관리자 알림 시스템
- [ ] 로그 수집 (Sentry, LogRocket 등)
- [ ] 정기적인 보안 감사

---

## 참고 문서

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Electron Security Guidelines](https://www.electronjs.org/docs/latest/tutorial/security)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Stripe Security](https://stripe.com/docs/security/stripe)

---

**작성일**: 2025-11-10
**마지막 업데이트**: 2025-11-10
**담당자**: 시스템 아키텍트
