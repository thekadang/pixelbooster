# 데이터베이스 스키마

Supabase PostgreSQL 데이터베이스 설계 및 RLS 정책을 정의합니다.

---

## 전체 ERD (Entity Relationship Diagram)

```
┌──────────────────┐
│   auth.users     │ (Supabase 제공)
│──────────────────│
│ id (PK)          │
│ email            │
│ created_at       │
└──────────────────┘
         │ 1
         │
         │ N
┌──────────────────┐
│  subscriptions   │
│──────────────────│
│ id (PK)          │
│ user_id (FK)     │───┐
│ tier             │   │
│ expires_at       │   │
│ created_at       │   │
│ updated_at       │   │
└──────────────────┘   │
         │ 1           │
         │             │
         │ N           │
┌──────────────────┐   │
│registered_devices│   │
│──────────────────│   │
│ id (PK)          │   │
│ user_id (FK)     │───┤
│ device_id        │   │
│ device_name      │   │
│ created_at       │   │
└──────────────────┘   │
                       │
┌──────────────────┐   │
│   affiliates     │   │
│──────────────────│   │
│ id (PK)          │   │
│ user_id (FK)     │───┘
│ tracking_code    │
│ commission_rate  │
│ created_at       │
└──────────────────┘
         │ 1
         │
         │ N
┌──────────────────────┐
│affiliate_referrals   │
│──────────────────────│
│ id (PK)              │
│ affiliate_id (FK)    │
│ referred_user_id (FK)│
│ subscription_id (FK) │
│ created_at           │
└──────────────────────┘
         │ 1
         │
         │ N
┌──────────────────┐
│  revenue_logs    │
│──────────────────│
│ id (PK)          │
│ user_id (FK)     │
│ affiliate_id (FK)│
│ amount           │
│ commission_amount│
│ created_at       │
└──────────────────┘
```

---

## 테이블 상세 정의

### 1. subscriptions (구독 정보)

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier TEXT CHECK (tier IN ('free', 'basic', 'pro')) NOT NULL DEFAULT 'free',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- 트리거: updated_at 자동 갱신
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**컬럼 설명**:
- `id`: 고유 식별자
- `user_id`: 사용자 ID (auth.users 참조)
- `tier`: 구독 등급 (`free`, `basic`, `pro`)
- `expires_at`: 구독 만료일 (NULL이면 무제한 Free)
- `created_at`: 구독 시작일
- `updated_at`: 마지막 수정일

---

### 2. registered_devices (등록된 기기)

```sql
CREATE TABLE registered_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT UNIQUE NOT NULL,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_registered_devices_user_id ON registered_devices(user_id);
CREATE INDEX idx_registered_devices_device_id ON registered_devices(device_id);

-- 제약 조건: 사용자당 최대 기기 수 체크는 애플리케이션 레벨에서 처리
```

**컬럼 설명**:
- `id`: 고유 식별자
- `user_id`: 사용자 ID
- `device_id`: 기기 고유 식별자 (UUID)
- `device_name`: 사용자 지정 기기 이름 (예: "내 맥북")
- `created_at`: 등록일

---

### 3. affiliates (어필리에이트 파트너)

```sql
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracking_code TEXT UNIQUE NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX idx_affiliates_tracking_code ON affiliates(tracking_code);

-- 체크 제약: 수수료율 0~100
ALTER TABLE affiliates ADD CONSTRAINT check_commission_rate
  CHECK (commission_rate >= 0 AND commission_rate <= 100);
```

**컬럼 설명**:
- `id`: 고유 식별자
- `user_id`: 파트너 사용자 ID
- `tracking_code`: 추천 코드 (예: `PARTNER123`)
- `commission_rate`: 수수료율 (%) - 기본 30%
- `created_at`: 파트너 등록일

---

### 4. affiliate_referrals (추천 기록)

```sql
CREATE TABLE affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_affiliate_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_referrals_referred_user_id ON affiliate_referrals(referred_user_id);
CREATE INDEX idx_affiliate_referrals_subscription_id ON affiliate_referrals(subscription_id);

-- 유니크 제약: 한 구독당 하나의 추천 기록만
CREATE UNIQUE INDEX unique_subscription_referral ON affiliate_referrals(subscription_id);
```

**컬럼 설명**:
- `id`: 고유 식별자
- `affiliate_id`: 추천한 파트너 ID
- `referred_user_id`: 추천받은 사용자 ID
- `subscription_id`: 연결된 구독 ID
- `created_at`: 추천 발생일

---

### 5. revenue_logs (수익 기록)

```sql
CREATE TABLE revenue_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_revenue_logs_user_id ON revenue_logs(user_id);
CREATE INDEX idx_revenue_logs_affiliate_id ON revenue_logs(affiliate_id);
CREATE INDEX idx_revenue_logs_created_at ON revenue_logs(created_at);
```

**컬럼 설명**:
- `id`: 고유 식별자
- `user_id`: 결제한 사용자 ID
- `affiliate_id`: 수수료를 받을 파트너 ID (NULL이면 직접 가입)
- `amount`: 결제 금액
- `commission_amount`: 파트너 수수료 금액
- `created_at`: 수익 발생일

---

## Row Level Security (RLS) 정책

### subscriptions 테이블

```sql
-- RLS 활성화
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 정책 1: 본인 구독 정보만 조회 가능
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 본인 구독 정보만 수정 가능 (앱에서는 서버 함수만 수정)
CREATE POLICY "Only service role can modify subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');
```

### registered_devices 테이블

```sql
-- RLS 활성화
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;

-- 정책 1: 본인 기기만 조회 가능
CREATE POLICY "Users can view own devices"
  ON registered_devices FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 본인 기기만 삭제 가능 (웹 UI에서 기기 해제)
CREATE POLICY "Users can delete own devices"
  ON registered_devices FOR DELETE
  USING (auth.uid() = user_id);

-- 정책 3: 기기 등록은 서버 함수만 가능
CREATE POLICY "Only service role can insert devices"
  ON registered_devices FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### affiliates 테이블

```sql
-- RLS 활성화
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- 정책 1: 본인 파트너 정보만 조회 가능
CREATE POLICY "Users can view own affiliate data"
  ON affiliates FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 관리자만 수정 가능
CREATE POLICY "Only service role can modify affiliates"
  ON affiliates FOR ALL
  USING (auth.role() = 'service_role');
```

### affiliate_referrals 테이블

```sql
-- RLS 활성화
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;

-- 정책 1: 파트너는 본인의 추천 기록만 조회 가능
CREATE POLICY "Partners can view own referrals"
  ON affiliate_referrals FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

-- 정책 2: 서버 함수만 삽입 가능
CREATE POLICY "Only service role can insert referrals"
  ON affiliate_referrals FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### revenue_logs 테이블

```sql
-- RLS 활성화
ALTER TABLE revenue_logs ENABLE ROW LEVEL SECURITY;

-- 정책 1: 본인의 결제 기록만 조회 가능
CREATE POLICY "Users can view own revenue"
  ON revenue_logs FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

-- 정책 2: 서버 함수만 삽입 가능
CREATE POLICY "Only service role can insert revenue"
  ON revenue_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

---

## 초기 데이터 (Seed)

```sql
-- 테스트 사용자 구독 생성 (개발 환경용)
INSERT INTO subscriptions (user_id, tier, expires_at) VALUES
  ('test-user-id-1', 'free', NULL),
  ('test-user-id-2', 'basic', NOW() + INTERVAL '30 days'),
  ('test-user-id-3', 'pro', NOW() + INTERVAL '365 days');

-- 테스트 어필리에이트 파트너
INSERT INTO affiliates (user_id, tracking_code, commission_rate) VALUES
  ('test-partner-id-1', 'PARTNER001', 30.00),
  ('test-partner-id-2', 'PARTNER002', 40.00);
```

---

## 헬퍼 함수

### updated_at 자동 갱신 함수

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 마이그레이션 관리

### 마이그레이션 파일 명명 규칙
```
YYYYMMDD_description.sql
예: 20251110_initial_schema.sql
```

### 마이그레이션 실행
```bash
# Supabase CLI 사용
supabase db push

# 또는 Supabase 대시보드에서 SQL Editor로 실행
```

---

## 쿼리 예제

### 사용자의 구독 정보 조회
```sql
SELECT
  s.tier,
  s.expires_at,
  CASE
    WHEN s.expires_at IS NULL THEN 'free'
    WHEN s.expires_at < NOW() THEN 'expired'
    ELSE 'active'
  END as status
FROM subscriptions s
WHERE s.user_id = 'user-id-here';
```

### 사용자의 등록된 기기 수 확인
```sql
SELECT COUNT(*) as device_count
FROM registered_devices
WHERE user_id = 'user-id-here';
```

### 파트너의 총 수익 조회
```sql
SELECT
  a.tracking_code,
  COUNT(ar.id) as total_referrals,
  SUM(rl.commission_amount) as total_commission
FROM affiliates a
LEFT JOIN affiliate_referrals ar ON ar.affiliate_id = a.id
LEFT JOIN revenue_logs rl ON rl.affiliate_id = a.id
WHERE a.user_id = 'partner-user-id-here'
GROUP BY a.id, a.tracking_code;
```

---

**참고 문서**:
- [전체 시스템 구조](system-overview.md)
- [보안 아키텍처](security-architecture.md)
- [API 명세](../api/api-specification.md)
