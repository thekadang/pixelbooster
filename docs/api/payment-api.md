# 결제 API 명세

> Stripe 기반 결제 및 구독 관리 API

**작성일**: 2025-11-10
**버전**: v1.0
**Base URL**: `https://[project-id].supabase.co/functions/v1`

---

## 📋 목차

1. [인증](#인증)
2. [Rate Limiting](#rate-limiting)
3. [공통 응답 형식](#공통-응답-형식)
4. [에러 코드](#에러-코드)
5. [API 엔드포인트](#api-엔드포인트)
   - [결제 세션 생성](#1-결제-세션-생성)
   - [Stripe Webhook](#2-stripe-webhook)
   - [구독 상태 확인](#3-구독-상태-확인)
   - [구독 취소](#4-구독-취소)
6. [Stripe 설정](#stripe-설정)
7. [테스트 가이드](#테스트-가이드)

---

## 인증

### JWT 토큰 (사용자 API)

```http
Authorization: Bearer <supabase-jwt-token>
```

- 모든 사용자 API는 Supabase Auth JWT 토큰이 필요합니다
- 토큰은 Supabase Auth를 통해 로그인 후 획득합니다
- 토큰 만료 시 401 Unauthorized 반환

### Stripe Webhook Secret (Webhook)

```http
stripe-signature: <stripe-webhook-signature>
```

- Webhook API는 Stripe 서명 검증을 사용합니다
- 환경 변수 `STRIPE_WEBHOOK_SECRET`에 설정된 값으로 검증
- 서명 불일치 시 400 Bad Request 반환

---

## Rate Limiting

| 엔드포인트 | 제한 | 시간 윈도우 |
|------------|------|-------------|
| `/create-checkout-session` | 10회 | 1분 |
| `/check-subscription` | 60회 | 1분 |
| `/cancel-subscription` | 5회 | 1분 |
| `/webhook-stripe` | 100회 | 1분 |

**초과 시 응답**:
```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60
}
```

**HTTP Status**: `429 Too Many Requests`

---

## 공통 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": {
    // 엔드포인트별 데이터
  }
}
```

### 에러 응답
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // 추가 에러 정보 (선택적)
  }
}
```

---

## 에러 코드

### 인증 관련 (4xx)

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `UNAUTHORIZED` | 401 | JWT 토큰이 없거나 유효하지 않음 |
| `FORBIDDEN` | 403 | 권한이 없는 요청 |
| `INVALID_TOKEN` | 401 | 토큰 형식이 잘못됨 |

### 요청 검증 관련 (4xx)

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `INVALID_REQUEST` | 400 | 필수 파라미터 누락 또는 형식 오류 |
| `INVALID_TIER` | 400 | 존재하지 않는 구독 등급 |
| `RATE_LIMIT_EXCEEDED` | 429 | API 호출 한도 초과 |

### 결제 관련 (4xx, 5xx)

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `STRIPE_ERROR` | 500 | Stripe API 호출 실패 |
| `PAYMENT_FAILED` | 400 | 결제 처리 실패 |
| `SUBSCRIPTION_NOT_FOUND` | 404 | 구독 정보를 찾을 수 없음 |
| `ALREADY_SUBSCRIBED` | 409 | 이미 해당 등급에 구독 중 |
| `WEBHOOK_SIGNATURE_INVALID` | 400 | Webhook 서명 검증 실패 |

### 서버 관련 (5xx)

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |
| `DATABASE_ERROR` | 500 | 데이터베이스 쿼리 실패 |

---

## API 엔드포인트

## 1. 결제 세션 생성

사용자가 구독을 업그레이드할 때 Stripe Checkout Session을 생성합니다.

### Endpoint
```
POST /create-checkout-session
```

### 인증
- **필수**: `Authorization: Bearer <jwt-token>`

### Request Body
```json
{
  "tier": "basic" | "pro",
  "return_url": "https://example.com/subscription/success"
}
```

#### 파라미터 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `tier` | `string` | ✅ | 구독 등급 (`basic`, `pro`) |
| `return_url` | `string` | ❌ | 결제 완료 후 리다이렉트 URL (기본값: 앱 딥링크) |

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "session_id": "cs_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "expires_at": "2025-11-10T15:30:00Z"
  }
}
```

#### 응답 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `checkout_url` | `string` | Stripe Checkout 페이지 URL |
| `session_id` | `string` | Stripe Session ID (추적용) |
| `expires_at` | `string` | 세션 만료 시간 (ISO 8601) |

### Error Responses

#### 400 Bad Request - 유효하지 않은 등급
```json
{
  "error": "Invalid subscription tier",
  "code": "INVALID_TIER",
  "details": {
    "valid_tiers": ["basic", "pro"]
  }
}
```

#### 409 Conflict - 이미 구독 중
```json
{
  "error": "Already subscribed to this tier",
  "code": "ALREADY_SUBSCRIBED",
  "details": {
    "current_tier": "basic",
    "requested_tier": "basic"
  }
}
```

#### 500 Internal Server Error - Stripe 오류
```json
{
  "error": "Failed to create checkout session",
  "code": "STRIPE_ERROR",
  "details": {
    "stripe_error": "api_key_expired"
  }
}
```

### 사용 예제

#### cURL
```bash
curl -X POST https://[project-id].supabase.co/functions/v1/create-checkout-session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "pro",
    "return_url": "pixelbooster://subscription/success"
  }'
```

#### JavaScript (Electron)
```typescript
async function createCheckout(tier: 'basic' | 'pro'): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    'https://[project-id].supabase.co/functions/v1/create-checkout-session',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tier,
        return_url: 'pixelbooster://subscription/success'
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const result = await response.json();
  return result.data.checkout_url;
}

// 사용
const checkoutUrl = await createCheckout('pro');
shell.openExternal(checkoutUrl);  // 브라우저에서 열기
```

---

## 2. Stripe Webhook

Stripe에서 발생한 이벤트를 수신하여 구독 상태를 업데이트합니다.

### Endpoint
```
POST /webhook-stripe
```

### 인증
- **필수**: `stripe-signature` 헤더 (Stripe에서 자동 추가)
- JWT 토큰 불필요 (Webhook Secret으로 검증)

### Request Headers
```
stripe-signature: t=1234567890,v1=abc123...
Content-Type: application/json
```

### Request Body

Stripe가 자동으로 전송하는 JSON 페이로드:

```json
{
  "id": "evt_1234567890abcdef",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_...",
      "customer": "cus_...",
      "subscription": "sub_...",
      "metadata": {
        "user_id": "uuid",
        "tier": "pro"
      }
    }
  }
}
```

### 지원하는 이벤트 타입

| Event Type | 설명 | 처리 내용 |
|------------|------|-----------|
| `checkout.session.completed` | 결제 완료 | 구독 활성화, `status='active'` |
| `invoice.payment_succeeded` | 결제 성공 (갱신) | `expires_at` 연장 |
| `invoice.payment_failed` | 결제 실패 | `status='suspended'`, 이메일 알림 |
| `customer.subscription.deleted` | 구독 취소 | `status='cancelled'`, `expires_at` 설정 |
| `customer.subscription.updated` | 구독 변경 | `tier` 업데이트 (업그레이드/다운그레이드) |

### Success Response (200 OK)
```json
{
  "received": true
}
```

### Error Responses

#### 400 Bad Request - 서명 검증 실패
```json
{
  "error": "Invalid webhook signature",
  "code": "WEBHOOK_SIGNATURE_INVALID"
}
```

#### 400 Bad Request - 알 수 없는 이벤트
```json
{
  "error": "Unknown event type",
  "code": "UNKNOWN_EVENT",
  "details": {
    "event_type": "unknown.event.type"
  }
}
```

### 이벤트별 처리 상세

#### checkout.session.completed
```typescript
// 처리 내용
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const { userId, tier } = session.metadata;

  // Stripe에서 구독 정보 재확인
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  // DB 업데이트
  await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      tier,
      status: 'active',
      expires_at: new Date(subscription.current_period_end * 1000),
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscription.id,
      updated_at: new Date()
    });

  // 이벤트 로깅
  await logUserEvent(userId, 'subscription_upgraded', { tier });
}
```

#### invoice.payment_succeeded
```typescript
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  // Stripe 구독 조회
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // DB 업데이트 (만료일 연장)
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'active',
      expires_at: new Date(subscription.current_period_end * 1000),
      updated_at: new Date()
    })
    .eq('stripe_subscription_id', subscriptionId);
}
```

#### invoice.payment_failed
```typescript
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  // 구독 일시 정지
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'suspended',
      updated_at: new Date()
    })
    .eq('stripe_subscription_id', subscriptionId);

  // 사용자에게 이메일 발송
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, auth.users(email)')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  await sendEmail(sub.users.email, 'payment_failed', {
    amount: invoice.amount_due / 100,
    next_attempt: invoice.next_payment_attempt
  });
}
```

#### customer.subscription.deleted
```typescript
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // 구독 취소 처리
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      expires_at: new Date(subscription.current_period_end * 1000),
      updated_at: new Date()
    })
    .eq('stripe_subscription_id', subscription.id);
}
```

### Webhook 설정 (Stripe Dashboard)

1. **Webhook URL 등록**:
   ```
   https://[project-id].supabase.co/functions/v1/webhook-stripe
   ```

2. **이벤트 선택**:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`

3. **Webhook Secret 복사**:
   ```
   whsec_...
   ```

4. **환경 변수 설정**:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## 3. 구독 상태 확인

사용자의 현재 구독 상태를 조회합니다.

### Endpoint
```
GET /check-subscription
```

### 인증
- **필수**: `Authorization: Bearer <jwt-token>`

### Request
- Body 없음 (JWT에서 user_id 추출)

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "tier": "pro",
    "status": "active",
    "features": {
      "formats": ["webp", "avif", "jxl"],
      "scopes": ["file", "folder"],
      "backup": true,
      "log": true,
      "max_batch_size": 200
    },
    "device_limit": 5,
    "device_count": 2,
    "expires_at": "2025-12-10T14:00:00Z",
    "stripe_subscription_id": "sub_1234567890"
  }
}
```

#### 응답 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `tier` | `string` | 구독 등급 (`free`, `basic`, `pro`) |
| `status` | `string` | 구독 상태 (`free`, `trial`, `active`, `expired`, `cancelled`, `suspended`) |
| `features` | `object` | 사용 가능한 기능 목록 (subscription_tiers.features) |
| `device_limit` | `number` | 등록 가능한 기기 수 |
| `device_count` | `number` | 현재 등록된 기기 수 |
| `expires_at` | `string` | 구독 만료일 (ISO 8601) |
| `stripe_subscription_id` | `string` | Stripe 구독 ID (있는 경우) |

### Success Response - Free 사용자
```json
{
  "success": true,
  "data": {
    "tier": "free",
    "status": "free",
    "features": {
      "formats": ["webp"],
      "scopes": ["file"],
      "backup": false,
      "log": false,
      "max_batch_size": 10
    },
    "device_limit": 2,
    "device_count": 1,
    "expires_at": null,
    "stripe_subscription_id": null
  }
}
```

### Success Response - 만료된 구독
```json
{
  "success": true,
  "data": {
    "tier": "basic",
    "status": "expired",
    "features": {
      "formats": ["webp"],
      "scopes": ["file"],
      "backup": false,
      "log": false,
      "max_batch_size": 10
    },
    "device_limit": 2,
    "device_count": 3,
    "expires_at": "2025-11-01T00:00:00Z",
    "stripe_subscription_id": "sub_1234567890",
    "message": "구독이 만료되었습니다. Free 등급으로 제한됩니다."
  }
}
```

### Error Responses

#### 404 Not Found - 구독 정보 없음
```json
{
  "error": "Subscription not found",
  "code": "SUBSCRIPTION_NOT_FOUND"
}
```

### 사용 예제

#### JavaScript (Electron)
```typescript
async function checkSubscription(): Promise<SubscriptionInfo> {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    'https://[project-id].supabase.co/functions/v1/check-subscription',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to check subscription');
  }

  const result = await response.json();
  return result.data;
}

// 캐싱과 함께 사용
class SubscriptionManager {
  private cache: SubscriptionInfo | null = null;
  private lastCheck: Date | null = null;
  private readonly CACHE_DURATION = 3600000; // 1시간

  async checkSubscription(forceRefresh = false): Promise<SubscriptionInfo> {
    if (!forceRefresh && this.cache && this.lastCheck &&
        Date.now() - this.lastCheck.getTime() < this.CACHE_DURATION) {
      return this.cache;
    }

    const info = await checkSubscription();

    // 만료 체크
    if (info.expires_at && new Date(info.expires_at) < new Date()) {
      info.status = 'expired';
      info.features = await this.getFreeFeatures();
    }

    this.cache = info;
    this.lastCheck = new Date();
    return info;
  }
}
```

---

## 4. 구독 취소

사용자의 Stripe 구독을 취소합니다. 즉시 취소되지 않고 현재 청구 기간이 끝날 때까지 유지됩니다.

### Endpoint
```
POST /cancel-subscription
```

### 인증
- **필수**: `Authorization: Bearer <jwt-token>`

### Request Body
```json
{
  "reason": "Too expensive" | "Not using enough" | "Missing features" | "Other",
  "feedback": "Optional user feedback text"
}
```

#### 파라미터 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `reason` | `string` | ❌ | 취소 사유 (분석용) |
| `feedback` | `string` | ❌ | 추가 피드백 (최대 500자) |

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "cancelled",
    "expires_at": "2025-12-10T14:00:00Z",
    "message": "구독이 취소되었습니다. 2025-12-10까지 계속 사용하실 수 있습니다."
  }
}
```

### Error Responses

#### 400 Bad Request - 활성 구독 없음
```json
{
  "error": "No active subscription to cancel",
  "code": "NO_ACTIVE_SUBSCRIPTION",
  "details": {
    "current_status": "free"
  }
}
```

#### 409 Conflict - 이미 취소됨
```json
{
  "error": "Subscription already cancelled",
  "code": "ALREADY_CANCELLED",
  "details": {
    "expires_at": "2025-12-10T14:00:00Z"
  }
}
```

### 사용 예제

#### JavaScript (Electron)
```typescript
async function cancelSubscription(
  reason?: string,
  feedback?: string
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    'https://[project-id].supabase.co/functions/v1/cancel-subscription',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason, feedback })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const result = await response.json();

  // UI 업데이트
  showNotification(result.data.message);

  // 캐시 무효화
  subscriptionManager.invalidateCache();
}

// UI에서 사용
button.addEventListener('click', async () => {
  const confirmed = await dialog.showMessageBox({
    type: 'question',
    message: '정말 구독을 취소하시겠습니까?',
    detail: '현재 청구 기간이 끝날 때까지 계속 사용하실 수 있습니다.',
    buttons: ['취소', '구독 취소']
  });

  if (confirmed.response === 1) {
    await cancelSubscription('Not using enough', 'UI가 복잡해요');
  }
});
```

---

## Stripe 설정

### 1. Stripe 계정 생성
1. [Stripe](https://stripe.com) 가입
2. 대시보드에서 API 키 확인

### 2. Price 생성

#### Basic 등급
```bash
stripe prices create \
  --product [product-id] \
  --unit-amount 999 \
  --currency usd \
  --recurring interval=month \
  --nickname "Basic Monthly"
```

**Price ID**: `price_1234567890_basic`

#### Pro 등급
```bash
stripe prices create \
  --product [product-id] \
  --unit-amount 1999 \
  --currency usd \
  --recurring interval=month \
  --nickname "Pro Monthly"
```

**Price ID**: `price_1234567890_pro`

### 3. Webhook 설정

#### 개발 환경 (Stripe CLI)
```bash
# Stripe CLI 설치
brew install stripe/stripe-cli/stripe

# Webhook 포워딩 시작
stripe listen --forward-to http://localhost:54321/functions/v1/webhook-stripe

# Secret 복사 (whsec_...)
```

#### 프로덕션 환경 (Dashboard)
1. [Stripe Dashboard - Webhooks](https://dashboard.stripe.com/webhooks) 접속
2. **Add endpoint** 클릭
3. **Endpoint URL** 입력:
   ```
   https://[project-id].supabase.co/functions/v1/webhook-stripe
   ```
4. **Events to send** 선택:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. **Signing secret** 복사

### 4. 환경 변수 설정

```bash
# Supabase Dashboard - Settings - Edge Functions
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 프로덕션
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. Price ID 매핑

```typescript
// server/supabase/functions/_shared/stripe-config.ts

const STRIPE_PRICE_IDS = {
  basic: process.env.STRIPE_BASIC_PRICE_ID || 'price_1234567890_basic',
  pro: process.env.STRIPE_PRO_PRICE_ID || 'price_1234567890_pro'
};

export function getPriceId(tier: 'basic' | 'pro'): string {
  return STRIPE_PRICE_IDS[tier];
}
```

---

## 테스트 가이드

### 1. 테스트 카드 번호

| 카드 번호 | 결과 | 설명 |
|-----------|------|------|
| `4242 4242 4242 4242` | 성공 | 일반 결제 성공 |
| `4000 0000 0000 0002` | 실패 | 카드 거부됨 |
| `4000 0000 0000 9995` | 실패 | 잔액 부족 |
| `4000 0027 6000 3184` | 3D Secure | 3D Secure 인증 필요 |

**만료일**: 미래의 아무 날짜 (예: 12/34)
**CVC**: 아무 3자리 숫자 (예: 123)
**ZIP**: 아무 우편번호 (예: 12345)

### 2. Webhook 테스트

#### Stripe CLI로 이벤트 트리거

```bash
# Checkout 완료 이벤트
stripe trigger checkout.session.completed

# 결제 성공 이벤트
stripe trigger invoice.payment_succeeded

# 결제 실패 이벤트
stripe trigger invoice.payment_failed

# 구독 취소 이벤트
stripe trigger customer.subscription.deleted
```

### 3. 통합 테스트 시나리오

#### 시나리오 1: 새 구독 생성
```bash
# 1. 결제 세션 생성
curl -X POST https://[project-id].supabase.co/functions/v1/create-checkout-session \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "pro"}'

# 2. Checkout URL로 이동하여 테스트 카드로 결제

# 3. Webhook 이벤트 확인 (Stripe Dashboard - Events)

# 4. 구독 상태 확인
curl -X GET https://[project-id].supabase.co/functions/v1/check-subscription \
  -H "Authorization: Bearer $JWT_TOKEN"
```

#### 시나리오 2: 구독 취소
```bash
# 1. 구독 취소 요청
curl -X POST https://[project-id].supabase.co/functions/v1/cancel-subscription \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Too expensive"}'

# 2. Stripe Dashboard에서 취소 확인

# 3. 구독 상태 확인 (status='cancelled', expires_at 확인)
curl -X GET https://[project-id].supabase.co/functions/v1/check-subscription \
  -H "Authorization: Bearer $JWT_TOKEN"
```

#### 시나리오 3: 결제 실패 시뮬레이션
```bash
# 1. Stripe CLI로 실패 이벤트 트리거
stripe trigger invoice.payment_failed

# 2. 구독 상태 확인 (status='suspended' 확인)
curl -X GET https://[project-id].supabase.co/functions/v1/check-subscription \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 4. Edge Function 로컬 테스트

```bash
# Supabase CLI 설치
npm install -g supabase

# Edge Functions 로컬 실행
supabase functions serve

# 함수 호출
curl -X POST http://localhost:54321/functions/v1/create-checkout-session \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "pro"}'
```

### 5. 자동화된 테스트 (Jest)

```typescript
// tests/api/payment.test.ts

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

describe('Payment API', () => {
  let supabase: ReturnType<typeof createClient>;
  let stripe: Stripe;
  let testUserId: string;
  let jwtToken: string;

  beforeAll(async () => {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // 테스트 사용자 생성
    const { data: { user } } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'TestPassword123!'
    });
    testUserId = user!.id;

    // JWT 토큰 획득
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'TestPassword123!'
    });
    jwtToken = session!.access_token;
  });

  describe('POST /create-checkout-session', () => {
    it('should create checkout session for Pro tier', async () => {
      const response = await fetch(
        'https://[project-id].supabase.co/functions/v1/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tier: 'pro' })
        }
      );

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.checkout_url).toMatch(/^https:\/\/checkout\.stripe\.com/);
      expect(result.data.session_id).toMatch(/^cs_test_/);
    });

    it('should reject invalid tier', async () => {
      const response = await fetch(
        'https://[project-id].supabase.co/functions/v1/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tier: 'invalid' })
        }
      );

      expect(response.status).toBe(400);
      const result = await response.json();

      expect(result.error).toBeTruthy();
      expect(result.code).toBe('INVALID_TIER');
    });
  });

  describe('GET /check-subscription', () => {
    it('should return free tier for new user', async () => {
      const response = await fetch(
        'https://[project-id].supabase.co/functions/v1/check-subscription',
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      const result = await response.json();

      expect(result.data.tier).toBe('free');
      expect(result.data.status).toBe('free');
      expect(result.data.features.max_batch_size).toBe(10);
    });
  });

  describe('POST /cancel-subscription', () => {
    it('should return error for user without active subscription', async () => {
      const response = await fetch(
        'https://[project-id].supabase.co/functions/v1/cancel-subscription',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'Test' })
        }
      );

      expect(response.status).toBe(400);
      const result = await response.json();

      expect(result.code).toBe('NO_ACTIVE_SUBSCRIPTION');
    });
  });

  afterAll(async () => {
    // 테스트 사용자 삭제
    await supabase.auth.admin.deleteUser(testUserId);
  });
});
```

---

## 부록: Stripe 객체 참조

### Checkout Session
```typescript
interface Stripe.Checkout.Session {
  id: string;
  object: 'checkout.session';
  customer: string | Stripe.Customer;
  subscription: string | Stripe.Subscription;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  metadata: {
    user_id: string;
    tier: string;
  };
  success_url: string;
  cancel_url: string;
  expires_at: number;  // Unix timestamp
}
```

### Subscription
```typescript
interface Stripe.Subscription {
  id: string;
  object: 'subscription';
  customer: string | Stripe.Customer;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
  current_period_end: number;  // Unix timestamp
  current_period_start: number;
  items: {
    data: Array<{
      price: {
        id: string;
        unit_amount: number;
        currency: string;
      };
    }>;
  };
}
```

### Invoice
```typescript
interface Stripe.Invoice {
  id: string;
  object: 'invoice';
  subscription: string | Stripe.Subscription;
  customer: string | Stripe.Customer;
  amount_due: number;  // cents
  amount_paid: number;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  next_payment_attempt: number | null;  // Unix timestamp
}
```

---

**관련 문서**:
- [subscription-service.md](../architecture/subscription-service.md) - 구독 서비스 전체 아키텍처
- [security-architecture.md](../architecture/security-architecture.md) - 결제 보안 상세
- [database-schema.md](../architecture/database-schema.md) - DB 스키마 정의
- [Stripe API Reference](https://stripe.com/docs/api) - Stripe 공식 문서
