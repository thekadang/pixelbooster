# 구독 서비스 아키텍처

더카당 픽셀부스터의 구독 시스템 전체 설계, 결제 연동, 생명주기 관리를 정의합니다.

---

## 목차
1. [시스템 개요](#시스템-개요)
2. [구독 등급 및 기능](#구독-등급-및-기능)
3. [구독 생명주기](#구독-생명주기)
4. [결제 시스템 연동 (Stripe)](#결제-시스템-연동-stripe)
5. [SubscriptionManager 설계](#subscriptionmanager-설계)
6. [구독 검증 로직](#구독-검증-로직)
7. [오프라인 지원](#오프라인-지원)
8. [Edge Functions](#edge-functions)

---

## 시스템 개요

### 아키텍처 원칙

1. **서버 기반 검증**: 모든 구독 정보는 서버에서 관리하고 검증
2. **클라이언트 캐싱**: 1시간 캐시로 서버 부하 감소 및 빠른 응답
3. **상태 머신**: 명확한 구독 상태 전이 규칙
4. **이벤트 기반**: 구독 상태 변경 시 이벤트 발생 및 기록

### 구독 시스템 흐름

```
사용자 → 앱 실행 → 구독 확인 → 기능 활성화/비활성화
                ↓
           Supabase DB
                ↓
        구독 정보 조회
                ↓
         tier + status
                ↓
      Feature 사용 가능 여부
```

---

## 구독 등급 및 기능

### 등급 비교표

| 기능 | Free | Basic | Pro |
|------|------|-------|-----|
| **변환 횟수** | 무제한 | 무제한 | 무제한 |
| **변환 형식** | WEBP만 | WEBP, AVIF | 모든 포맷 |
| **작동 범위** | 파일 선택 | + 폴더 선택 | + 컴퓨터 전체 |
| **백업 기능** | ❌ | ✅ | ✅ |
| **로그 기록** | ❌ | ✅ (Excel) | ✅ (Excel) |
| **등록 기기** | 1대 | 2대 | 5대 |
| **가격 (월간)** | $0 | $9.99 | $19.99 |
| **가격 (연간)** | $0 | $99.99 (17% 할인) | $199.99 (17% 할인) |

### subscription_tiers 테이블 활용

등급 정보는 `subscription_tiers` 테이블에서 동적으로 관리됩니다.

```typescript
// 서버에서 등급 정보 조회
const { data: tiers } = await supabase
  .from('subscription_tiers')
  .select('*')
  .eq('is_active', true)
  .order('sort_order');

// features JSON 파싱
const basicFeatures = tiers.find(t => t.name === 'basic').features;
// {
//   "formats": ["webp", "avif"],
//   "scopes": ["file", "folder"],
//   "backup": true,
//   "log": true,
//   "max_batch_size": 200
// }
```

**장점**:
- 새 등급 추가 시 DB INSERT만으로 가능 (코드 수정 불필요)
- 기능 활성화/비활성화가 동적으로 가능
- A/B 테스트 용이

---

## 구독 생명주기

### 구독 상태 (Status)

```
FREE ───────────────┐
  ↑                 ↓
  │    결제 성공   ACTIVE ←──── TRIAL
  │      ←──────────│
  │                 │ 만료/갱신실패
  │                 ↓
  └───────────── EXPIRED
        ↑            ↓
        │            │ 재구독
        │            ↓
     CANCELLED ←── ACTIVE
        ↓
      FREE

SUSPENDED (결제 실패로 일시 정지)
     ↑ ↓
   ACTIVE
```

### 상태 설명

| 상태 | 설명 | 기능 사용 가능 |
|------|------|---------------|
| `free` | 무료 등급 (기본) | Free 기능만 |
| `trial` | 무료 체험 기간 | 해당 등급 기능 |
| `active` | 활성 유료 구독 | 해당 등급 기능 |
| `expired` | 만료됨 | Free 기능으로 복귀 |
| `cancelled` | 취소됨 (현재 기간까지 유지) | 해당 등급 기능 (만료일까지) |
| `suspended` | 결제 실패로 일시 정지 | Free 기능으로 제한 |

### 상태 전이 규칙

```typescript
// 상태 전이 검증
function canTransitionTo(currentStatus: Status, newStatus: Status): boolean {
  const transitions: Record<Status, Status[]> = {
    free: ['trial', 'active'],
    trial: ['active', 'expired', 'cancelled'],
    active: ['cancelled', 'suspended', 'expired'],
    expired: ['active', 'free'],
    cancelled: ['free', 'active'],  // 재구독 가능
    suspended: ['active', 'cancelled']
  };

  return transitions[currentStatus]?.includes(newStatus) || false;
}
```

---

## 결제 시스템 연동 (Stripe)

### Stripe 선택 이유

- ✅ 가장 강력한 구독 관리 기능
- ✅ 안정적인 Webhook 시스템
- ✅ 글로벌 결제 지원
- ✅ 한국 회사 등록 가능 (Stripe Atlas 또는 해외 법인)

### 결제 플로우

```
1. 사용자가 앱에서 "Pro 업그레이드" 클릭
   ↓
2. 클라이언트 → Supabase Edge Function
   POST /create-checkout-session
   { userId, tier: 'pro', interval: 'monthly' }
   ↓
3. Edge Function → Stripe API
   stripe.checkout.sessions.create({
     customer_email: user.email,
     mode: 'subscription',
     line_items: [{
       price: 'price_pro_monthly',  // Stripe Price ID
       quantity: 1
     }],
     success_url: 'pixelbooster://payment/success',
     cancel_url: 'pixelbooster://payment/cancel'
   })
   ↓
4. Edge Function → 클라이언트
   { sessionUrl: 'https://checkout.stripe.com/...' }
   ↓
5. 클라이언트 → 기본 브라우저 열기
   shell.openExternal(sessionUrl)
   ↓
6. 사용자 결제 완료
   ↓
7. Stripe → Edge Function
   Webhook: checkout.session.completed
   ↓
8. Edge Function → Supabase DB
   UPDATE subscriptions SET
     tier = 'pro',
     status = 'active',
     expires_at = NOW() + 30일,
     stripe_subscription_id = 'sub_xxx'
   ↓
9. 브라우저 → Deep Link
   pixelbooster://payment/success
   ↓
10. 앱 → 구독 상태 재확인
    GET /check-subscription
    ↓
11. UI 업데이트 (Pro 기능 활성화)
```

### Stripe 설정

#### 1. Stripe Price 생성

```bash
# Stripe CLI 또는 대시보드에서 생성

# Basic 월간
stripe prices create \
  --currency=usd \
  --unit-amount=999 \
  --recurring interval=month \
  --product=prod_basic \
  --nickname="Basic Monthly"
# → price_basic_monthly

# Basic 연간
stripe prices create \
  --currency=usd \
  --unit-amount=9999 \
  --recurring interval=year \
  --product=prod_basic \
  --nickname="Basic Yearly"
# → price_basic_yearly

# Pro 월간/연간도 동일하게 생성
```

#### 2. Webhook Endpoint 설정

```
Stripe Dashboard → Developers → Webhooks → Add endpoint

URL: https://[your-supabase-project].supabase.co/functions/v1/webhook-stripe
Events:
  - checkout.session.completed
  - invoice.payment_succeeded
  - invoice.payment_failed
  - customer.subscription.updated
  - customer.subscription.deleted

Webhook Secret: whsec_...
```

### Edge Function: create-checkout-session

```typescript
// server/supabase/functions/create-checkout-session/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16'
});

const PRICE_IDS: Record<string, string> = {
  'basic_monthly': Deno.env.get('STRIPE_PRICE_BASIC_MONTHLY')!,
  'basic_yearly': Deno.env.get('STRIPE_PRICE_BASIC_YEARLY')!,
  'pro_monthly': Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')!,
  'pro_yearly': Deno.env.get('STRIPE_PRICE_PRO_YEARLY')!
};

serve(async (req) => {
  try {
    const { userId, tier, interval } = await req.json();

    // Rate Limiting (생략 - rate-limiter 사용)

    // 사용자 정보 조회
    const { data: user, error: userError } = await supabaseAdmin
      .from('auth.users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) throw new Error('User not found');

    // Price ID 결정
    const priceKey = `${tier}_${interval}`;
    const priceId = PRICE_IDS[priceKey];

    if (!priceId) throw new Error('Invalid tier or interval');

    // Stripe Checkout Session 생성
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: 'pixelbooster://payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'pixelbooster://payment/cancel',
      metadata: {
        userId,
        tier,
        interval
      }
    });

    return new Response(
      JSON.stringify({ sessionUrl: session.url }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
```

### Edge Function: webhook-stripe

```typescript
// server/supabase/functions/webhook-stripe/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;

  try {
    // 서명 검증 (매우 중요!)
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  // 이벤트 타입별 처리
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
  }

  return new Response('OK', { status: 200 });
});

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
      stripe_subscription_id: subscription.id
    });

  // 이벤트 로깅
  await supabaseAdmin
    .from('user_events')
    .insert({
      user_id: userId,
      event_type: 'subscription_create',
      event_data: { tier, stripe_subscription_id: subscription.id }
    });

  // 어필리에이트 수수료 처리 (생략)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  // 구독 정보 조회
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) return;

  // Stripe에서 최신 정보 확인
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  // 갱신 성공 - 만료일 연장
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'active',
      expires_at: new Date(stripeSubscription.current_period_end * 1000)
    })
    .eq('id', subscription.id);

  // 수익 로그
  await supabaseAdmin
    .from('revenue_logs')
    .insert({
      user_id: subscription.user_id,
      amount: invoice.amount_paid / 100,
      created_at: new Date()
    });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  // 구독 상태를 suspended로 변경
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'suspended' })
    .eq('stripe_subscription_id', subscriptionId);

  // 사용자에게 알림 (이메일, 푸시 등 - 선택사항)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // 구독 취소 처리
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'free',
      tier: 'free',
      expires_at: null,
      stripe_subscription_id: null
    })
    .eq('stripe_subscription_id', subscription.id);
}
```

---

## SubscriptionManager 설계

### 클래스 구조

```typescript
// client/src/services/SubscriptionManager.ts
import { createClient } from '@supabase/supabase-js';

interface SubscriptionInfo {
  tier: 'free' | 'basic' | 'pro';
  status: 'free' | 'trial' | 'active' | 'expired' | 'cancelled' | 'suspended';
  expires_at: Date | null;
  features: {
    formats: string[];
    scopes: string[];
    backup: boolean;
    log: boolean;
    max_batch_size: number;
  };
}

class SubscriptionManager {
  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  private cache: SubscriptionInfo | null = null;
  private lastCheck: Date | null = null;
  private readonly CACHE_DURATION = 3600000; // 1시간

  /**
   * 구독 정보 확인 (캐싱 사용)
   */
  async checkSubscription(forceRefresh = false): Promise<SubscriptionInfo> {
    // 캐시 유효성 확인
    if (!forceRefresh &&
        this.cache &&
        this.lastCheck &&
        Date.now() - this.lastCheck.getTime() < this.CACHE_DURATION) {
      return this.cache;
    }

    // 서버에서 최신 정보 가져오기
    const { data: user } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: subscription, error } = await this.supabase
      .from('subscriptions')
      .select(`
        tier,
        status,
        expires_at,
        subscription_tiers (
          features
        )
      `)
      .eq('user_id', user.user.id)
      .single();

    if (error) {
      // 구독 정보 없음 → Free 등급
      return this.createFreeSubscription();
    }

    // 만료 확인
    if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
      // 만료됨 → 서버에 상태 업데이트 요청
      await this.updateSubscriptionStatus(user.user.id, 'expired');
      subscription.status = 'expired';
    }

    // 캐시 업데이트
    this.cache = {
      tier: subscription.tier,
      status: subscription.status,
      expires_at: subscription.expires_at ? new Date(subscription.expires_at) : null,
      features: subscription.subscription_tiers.features
    };
    this.lastCheck = new Date();

    return this.cache;
  }

  /**
   * 기능 사용 가능 여부 확인
   */
  async canUseFeature(featureName: string): Promise<boolean> {
    const subscription = await this.checkSubscription();

    // 만료된 구독은 Free로 제한
    if (['expired', 'suspended'].includes(subscription.status)) {
      const freeFeatures = await this.getFreeFeatures();
      return this.checkFeatureAvailable(featureName, freeFeatures);
    }

    // 취소된 구독은 만료일까지 사용 가능
    if (subscription.status === 'cancelled') {
      if (subscription.expires_at && new Date() < subscription.expires_at) {
        return this.checkFeatureAvailable(featureName, subscription.features);
      } else {
        const freeFeatures = await this.getFreeFeatures();
        return this.checkFeatureAvailable(featureName, freeFeatures);
      }
    }

    // 정상 구독
    return this.checkFeatureAvailable(featureName, subscription.features);
  }

  /**
   * 포맷 변환 가능 여부
   */
  async canConvertFormat(fromFormat: string, toFormat: string): Promise<boolean> {
    const subscription = await this.checkSubscription();
    const formats = subscription.features.formats;

    if (formats.includes('all')) return true;
    return formats.includes(toFormat.toLowerCase());
  }

  /**
   * 작동 범위 사용 가능 여부
   */
  async canUseScope(scope: 'file' | 'folder' | 'computer'): Promise<boolean> {
    const subscription = await this.checkSubscription();
    return subscription.features.scopes.includes(scope);
  }

  /**
   * 백업 기능 사용 가능 여부
   */
  async canUseBackup(): Promise<boolean> {
    const subscription = await this.checkSubscription();
    return subscription.features.backup;
  }

  /**
   * 로그 기능 사용 가능 여부
   */
  async canUseLog(): Promise<boolean> {
    const subscription = await this.checkSubscription();
    return subscription.features.log;
  }

  /**
   * 오프라인 모드 (Grace Period 7일)
   */
  canUseFeatureOffline(featureName: string): boolean {
    if (!this.cache || !this.lastCheck) return false;

    const daysSinceCheck = (Date.now() - this.lastCheck.getTime()) / (1000 * 60 * 60 * 24);

    // 7일 이내면 캐시된 정보로 판단
    if (daysSinceCheck <= 7) {
      return this.checkFeatureAvailable(featureName, this.cache.features);
    }

    // 7일 초과 → Free로 제한
    return false;
  }

  /**
   * 구독 업그레이드
   */
  async upgradeSubscription(tier: 'basic' | 'pro', interval: 'monthly' | 'yearly') {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Edge Function 호출하여 Checkout Session 생성
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        userId: user.user.id,
        tier,
        interval
      })
    });

    const { sessionUrl } = await response.json();

    // 기본 브라우저로 Stripe Checkout 열기
    const { shell } = require('electron');
    shell.openExternal(sessionUrl);
  }

  /**
   * 구독 취소
   */
  async cancelSubscription() {
    // Stripe에 구독 취소 요청 (Edge Function 호출)
    // 즉시 종료 X, 현재 기간 끝까지 유지
  }

  // ===== Private Methods =====

  private createFreeSubscription(): SubscriptionInfo {
    return {
      tier: 'free',
      status: 'free',
      expires_at: null,
      features: {
        formats: ['webp'],
        scopes: ['file'],
        backup: false,
        log: false,
        max_batch_size: 50
      }
    };
  }

  private async getFreeFeatures() {
    const { data } = await this.supabase
      .from('subscription_tiers')
      .select('features')
      .eq('name', 'free')
      .single();

    return data?.features || this.createFreeSubscription().features;
  }

  private checkFeatureAvailable(featureName: string, features: any): boolean {
    // features JSON에서 기능 확인 로직
    switch (featureName) {
      case 'backup':
        return features.backup === true;
      case 'log':
        return features.log === true;
      default:
        return false;
    }
  }

  private async updateSubscriptionStatus(userId: string, status: string) {
    // Edge Function 호출하여 서버에서 상태 업데이트
    await fetch(`${SUPABASE_URL}/functions/v1/update-subscription-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({ userId, status })
    });
  }
}

export default new SubscriptionManager();
```

---

## 구독 검증 로직

### UI에서 기능 활성화/비활성화

```typescript
// client/src/components/SettingsPanel.tsx
import SubscriptionManager from '../services/SubscriptionManager';

function SettingsPanel() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    const sub = await SubscriptionManager.checkSubscription();
    setSubscription(sub);
  }

  async function handleFormatChange(format: string) {
    const canUse = await SubscriptionManager.canConvertFormat('jpg', format);

    if (!canUse) {
      // 업그레이드 유도
      showUpgradeDialog(`${format.toUpperCase()} format requires ${getRequiredTier(format)} plan`);
      return;
    }

    setSelectedFormat(format);
  }

  return (
    <div>
      <h2>Output Format</h2>
      <select onChange={(e) => handleFormatChange(e.target.value)}>
        <option value="webp">WEBP (Free)</option>
        <option value="avif" disabled={subscription?.tier === 'free'}>
          AVIF {subscription?.tier === 'free' && '(Basic+)'}
        </option>
        <option value="jpg" disabled={subscription?.tier !== 'pro'}>
          JPG {subscription?.tier !== 'pro' && '(Pro only)'}
        </option>
      </select>

      {subscription?.status === 'cancelled' && subscription.expires_at && (
        <Alert>
          Your subscription will expire on {subscription.expires_at.toLocaleDateString()}.
          Features will be limited to Free plan after expiration.
        </Alert>
      )}
    </div>
  );
}
```

### 이미지 변환 시 검증

```typescript
// client/src/core/ImageProcessor.ts
import SubscriptionManager from '../services/SubscriptionManager';

class ImageProcessor {
  async processImages(files: File[], options: ConversionOptions) {
    // 1. 구독 확인
    const canConvert = await SubscriptionManager.canConvertFormat(
      options.fromFormat,
      options.toFormat
    );

    if (!canConvert) {
      throw new Error(`Your plan does not support ${options.toFormat} conversion`);
    }

    // 2. 배치 크기 확인
    const subscription = await SubscriptionManager.checkSubscription();
    if (files.length > subscription.features.max_batch_size) {
      throw new Error(`Your plan allows up to ${subscription.features.max_batch_size} files per batch`);
    }

    // 3. 변환 실행
    for (const file of files) {
      await this.convertImage(file, options);
    }

    // 4. 백업 (등급 확인)
    if (options.backup && await SubscriptionManager.canUseBackup()) {
      await this.backupOriginals(files);
    }

    // 5. 로그 (등급 확인)
    if (await SubscriptionManager.canUseLog()) {
      await this.logConversion(files, options);
    }
  }
}
```

---

## 오프라인 지원

### Grace Period (7일)

사용자가 인터넷에 연결되지 않은 상태에서도 마지막 확인 후 7일간은 구독 기능을 사용할 수 있습니다.

```typescript
class SubscriptionManager {
  async checkSubscription(forceRefresh = false): Promise<SubscriptionInfo> {
    // 온라인인 경우
    if (navigator.onLine) {
      return await this.fetchFromServer();
    }

    // 오프라인인 경우
    if (!this.cache || !this.lastCheck) {
      // 캐시 없음 → Free로 제한
      return this.createFreeSubscription();
    }

    const daysSinceCheck = (Date.now() - this.lastCheck.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCheck <= 7) {
      // 7일 이내 → 캐시 사용
      console.log(`Using cached subscription (offline mode, ${Math.floor(daysSinceCheck)} days old)`);
      return this.cache;
    } else {
      // 7일 초과 → Free로 제한
      console.warn('Subscription cache expired (offline > 7 days), limiting to Free features');
      return this.createFreeSubscription();
    }
  }
}
```

### 로컬 저장소

캐시는 `electron-store`로 암호화하여 저장합니다.

```typescript
import Store from 'electron-store';

const store = new Store({
  encryptionKey: machineId,
  name: 'subscription-cache'
});

// 캐시 저장
store.set('subscription', {
  ...subscription,
  lastCheck: new Date().toISOString()
});

// 캐시 로드
const cached = store.get('subscription');
```

---

## Edge Functions

### check-subscription

사용자의 현재 구독 정보를 반환합니다.

```typescript
// server/supabase/functions/check-subscription/index.ts
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')!;
  const token = authHeader.replace('Bearer ', '');

  // 사용자 확인
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 구독 정보 조회
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select(`
      *,
      subscription_tiers (*)
    `)
    .eq('user_id', user.id)
    .single();

  if (!subscription) {
    // Free 등급 반환
    return new Response(JSON.stringify({
      tier: 'free',
      status: 'free',
      features: { /* Free features */ }
    }));
  }

  // 만료 확인
  if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
    // 만료 → 상태 업데이트
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'expired', tier: 'free' })
      .eq('id', subscription.id);

    subscription.status = 'expired';
    subscription.tier = 'free';
  }

  return new Response(JSON.stringify({
    tier: subscription.tier,
    status: subscription.status,
    expires_at: subscription.expires_at,
    features: subscription.subscription_tiers.features
  }));
});
```

### cancel-subscription

사용자가 구독을 취소합니다 (즉시 종료 X, 현재 기간 끝까지 유지).

```typescript
// server/supabase/functions/cancel-subscription/index.ts
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')!;
  const token = authHeader.replace('Bearer ', '');

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 구독 정보 조회
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!subscription || !subscription.stripe_subscription_id) {
    return new Response('No active subscription', { status: 400 });
  }

  // Stripe에 취소 요청 (기간 끝에 취소)
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true
  });

  // DB 상태 업데이트
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscription.id);

  return new Response(JSON.stringify({
    message: `Subscription will be cancelled on ${subscription.expires_at}`
  }));
});
```

---

## 참고 문서

- [데이터베이스 스키마](database-schema.md)
- [결제 API 명세](../api/payment-api.md)
- [보안 아키텍처](security-architecture.md)
- [Stripe Documentation](https://stripe.com/docs/billing/subscriptions/overview)

---

**작성일**: 2025-11-10
**마지막 업데이트**: 2025-11-10
**담당자**: 시스템 아키텍트
