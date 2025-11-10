# 데이터베이스 스키마

Supabase PostgreSQL 데이터베이스 설계 및 RLS 정책을 정의합니다.

---

## 전체 ERD (Entity Relationship Diagram)

```
┌──────────────────────┐
│   auth.users         │ (Supabase 제공)
│──────────────────────│
│ id (PK)              │
│ email                │
│ created_at           │
└──────────────────────┘
         │ 1
         ├──────────────────────────────────┐
         │                                  │
         │ N                                │ N
┌──────────────────────┐         ┌──────────────────────┐
│  subscriptions       │         │ registered_devices   │
│──────────────────────│         │──────────────────────│
│ id (PK)              │         │ id (PK)              │
│ user_id (FK)         │         │ user_id (FK)         │
│ tier                 │         │ device_id            │
│ status               │ ⭐      │ device_name          │
│ expires_at           │         │ created_at           │
│ stripe_customer_id   │ ⭐      └──────────────────────┘
│ stripe_subscription  │ ⭐
│ created_at           │
│ updated_at           │
└──────────────────────┘
         │ 1
         │
         │ N                  ┌──────────────────────┐
┌──────────────────────┐      │ subscription_tiers   │ ⭐ 확장성
│   affiliates         │      │──────────────────────│
│──────────────────────│      │ id (PK)              │
│ id (PK)              │      │ name                 │
│ user_id (FK)         │      │ display_name (JSONB) │
│ tracking_code        │      │ features (JSONB)     │
│ commission_rate      │      │ price_monthly        │
│ created_at           │      │ device_limit         │
└──────────────────────┘      └──────────────────────┘
         │ 1
         │
         │ N                  ┌──────────────────────┐
┌──────────────────────┐      │ feature_flags        │ ⭐ 확장성
│affiliate_referrals   │      │──────────────────────│
│──────────────────────│      │ id (PK)              │
│ id (PK)              │      │ key                  │
│ affiliate_id (FK)    │      │ name (JSONB)         │
│ referred_user_id (FK)│      │ min_tier_id (FK)     │
│ subscription_id (FK) │      │ is_enabled           │
│ created_at           │      │ config (JSONB)       │
└──────────────────────┘      └──────────────────────┘
         │ 1
         │
         │ N                  ┌──────────────────────┐
┌──────────────────────┐      │ user_events          │ ⭐ 확장성
│  revenue_logs        │      │──────────────────────│
│──────────────────────│      │ id (PK)              │
│ id (PK)              │      │ user_id (FK)         │
│ user_id (FK)         │      │ event_type           │
│ affiliate_id (FK)    │      │ event_data (JSONB)   │
│ amount               │      │ ip_address           │
│ commission_amount    │      │ created_at           │
│ created_at           │      └──────────────────────┘
└──────────────────────┘
                              ┌──────────────────────┐
                              │ abuse_prevention     │ ⭐ 보안
                              │──────────────────────│
                              │ id (PK)              │
                              │ user_id (FK)         │
                              │ ip_address           │
                              │ event_type           │
                              │ severity             │
                              │ is_resolved          │
                              │ created_at           │
                              └──────────────────────┘

⭐ 표시: 새로 추가된 컬럼/테이블 (확장성 및 보안 강화)
```

---

## 테이블 상세 정의

### 1. subscriptions (구독 정보)

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier TEXT CHECK (tier IN ('free', 'basic', 'pro')) NOT NULL DEFAULT 'free',
  status TEXT CHECK (status IN ('free', 'trial', 'active', 'expired', 'cancelled', 'suspended')) NOT NULL DEFAULT 'free',
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Stripe 관련 (Phase 2)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- MVP: 관리자 선물 기능 ⭐
  granted_by UUID REFERENCES auth.users(id),  -- 관리자 ID
  payment_method TEXT CHECK (payment_method IN ('admin_grant', 'stripe')) DEFAULT 'admin_grant',
  grant_reason TEXT,  -- "베타 테스터", "이벤트 당첨" 등
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_granted_by ON subscriptions(granted_by);  -- MVP ⭐

-- 유니크 제약: 사용자당 하나의 구독만
CREATE UNIQUE INDEX unique_user_subscription ON subscriptions(user_id);

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
- `status`: 구독 상태 (`free`, `trial`, `active`, `expired`, `cancelled`, `suspended`)
- `expires_at`: 구독 만료일 (NULL이면 무제한 Free)
- `stripe_customer_id`: Stripe 고객 ID (Phase 2)
- `stripe_subscription_id`: Stripe 구독 ID (Phase 2)
- `granted_by`: 관리자 ID (MVP - 관리자 선물 기능) ⭐
- `payment_method`: 결제 방법 (`admin_grant` = 관리자 부여, `stripe` = 정기구독) ⭐
- `grant_reason`: 부여 사유 (MVP - "베타 테스터", "이벤트 당첨" 등) ⭐
- `created_at`: 구독 시작일
- `updated_at`: 마지막 수정일

**상태 설명**:
- `free`: 무료 등급 (기본)
- `trial`: 무료 체험 (향후 추가)
- `active`: 활성 유료 구독
- `expired`: 만료됨 (갱신 실패)
- `cancelled`: 취소됨 (현재 기간까지 사용 가능)
- `suspended`: 결제 실패로 일시 정지

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

### 6. subscription_tiers (구독 등급 관리) ⭐ 확장성

동적 구독 등급 관리를 위한 테이블. 새 등급 추가 시 코드 수정 없이 DB만 변경.

```sql
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,              -- 'free', 'basic', 'pro'
  display_name JSONB NOT NULL,            -- {"ko": "무료", "en": "Free"}
  description JSONB,                      -- {"ko": "설명", "en": "Description"}
  features JSONB NOT NULL,                -- 등급별 기능 정의
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  device_limit INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_subscription_tiers_name ON subscription_tiers(name);
CREATE INDEX idx_subscription_tiers_sort_order ON subscription_tiers(sort_order);
CREATE INDEX idx_subscription_tiers_is_active ON subscription_tiers(is_active);

-- 트리거
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 초기 데이터
INSERT INTO subscription_tiers (name, display_name, description, features, price_monthly, price_yearly, device_limit, sort_order) VALUES
(
  'free',
  '{"ko": "무료", "en": "Free"}',
  '{"ko": "기본 WEBP 변환 기능", "en": "Basic WEBP conversion"}',
  '{
    "formats": ["webp"],
    "scopes": ["file"],
    "backup": false,
    "log": false,
    "max_batch_size": 50
  }',
  NULL,
  NULL,
  1,
  1
),
(
  'basic',
  '{"ko": "베이직", "en": "Basic"}',
  '{"ko": "WEBP, AVIF 변환 및 백업", "en": "WEBP, AVIF conversion with backup"}',
  '{
    "formats": ["webp", "avif"],
    "scopes": ["file", "folder"],
    "backup": true,
    "log": true,
    "max_batch_size": 200
  }',
  9.99,
  99.99,
  2,
  2
),
(
  'pro',
  '{"ko": "프로", "en": "Pro"}',
  '{"ko": "모든 포맷 변환 및 컴퓨터 전체 스캔", "en": "All format conversion and full system scan"}',
  '{
    "formats": ["all"],
    "scopes": ["file", "folder", "computer"],
    "backup": true,
    "log": true,
    "max_batch_size": 1000
  }',
  19.99,
  199.99,
  5,
  3
);
```

**컬럼 설명**:
- `name`: 등급 식별자 (코드에서 사용)
- `display_name`: 다국어 표시 이름
- `description`: 다국어 설명
- `features`: 등급별 기능 (JSON)
- `price_monthly`: 월간 가격 (USD)
- `price_yearly`: 연간 가격 (USD)
- `device_limit`: 등록 가능한 기기 수
- `sort_order`: 표시 순서
- `is_active`: 활성 상태 (비활성 등급은 숨김)

**features JSON 구조**:
```json
{
  "formats": ["webp", "avif"],  // 지원 포맷 목록
  "scopes": ["file", "folder"],  // 작동 범위
  "backup": true,               // 백업 기능
  "log": true,                  // 로그 기록
  "max_batch_size": 200         // 최대 배치 크기
}
```

---

### 7. feature_flags (기능 플래그) ⭐ 확장성

새 기능을 실험하거나 등급별로 점진적으로 출시할 때 사용.

```sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,               -- 'cloud_backup', 'ai_upscaling'
  name JSONB NOT NULL,                    -- {"ko": "AI 업스케일링", "en": "AI Upscaling"}
  description JSONB,
  min_tier_id UUID REFERENCES subscription_tiers(id),
  is_enabled BOOLEAN DEFAULT false,
  config JSONB,                           -- 기능별 설정
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_is_enabled ON feature_flags(is_enabled);
CREATE INDEX idx_feature_flags_min_tier_id ON feature_flags(min_tier_id);

-- 트리거
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**컬럼 설명**:
- `key`: 기능 식별자 (코드에서 사용)
- `name`: 다국어 이름
- `description`: 다국어 설명
- `min_tier_id`: 최소 필요 등급 (NULL이면 모든 등급 가능)
- `is_enabled`: 전역 활성화 여부
- `config`: 기능별 추가 설정

**사용 예시**:
```sql
-- 향후 추가될 AI 업스케일링 기능
INSERT INTO feature_flags (key, name, min_tier_id, is_enabled, config) VALUES
(
  'ai_upscaling',
  '{"ko": "AI 업스케일링", "en": "AI Upscaling"}',
  (SELECT id FROM subscription_tiers WHERE name = 'pro'),
  false,  -- 아직 개발 중
  '{
    "max_size": 4096,
    "models": ["esrgan", "realesrgan"]
  }'
);
```

---

### 8. user_events (사용자 이벤트 로그) ⭐ 확장성

사용자 활동을 기록하여 분석 및 어뷰징 감지에 활용.

```sql
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,               -- 'conversion', 'login', 'upgrade', 'device_register'
  event_data JSONB,                       -- 이벤트별 데이터
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_event_type ON user_events(event_type);
CREATE INDEX idx_user_events_created_at ON user_events(created_at);
CREATE INDEX idx_user_events_ip_address ON user_events(ip_address);

-- 파티셔닝 (선택사항, 데이터 많아지면 적용)
-- CREATE TABLE user_events_2025_11 PARTITION OF user_events
--   FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

**컬럼 설명**:
- `user_id`: 사용자 ID (탈퇴 시에도 로그 유지: SET NULL)
- `event_type`: 이벤트 타입
- `event_data`: 이벤트별 추가 데이터 (JSON)
- `ip_address`: IP 주소 (어뷰징 감지)
- `user_agent`: User Agent (기기 정보)
- `created_at`: 발생 시각

**이벤트 타입**:
- `conversion`: 이미지 변환
- `login`: 로그인
- `logout`: 로그아웃
- `upgrade`: 등급 업그레이드
- `downgrade`: 등급 다운그레이드
- `device_register`: 새 기기 등록
- `device_remove`: 기기 제거
- `subscription_create`: 구독 생성
- `subscription_cancel`: 구독 취소

**event_data 예시**:
```json
{
  "files_count": 150,
  "total_size_mb": 450.5,
  "format_from": "jpg",
  "format_to": "webp",
  "duration_ms": 12350
}
```

---

### 9. abuse_prevention (어뷰징 방지) ⭐ 보안

의심스러운 활동을 기록하고 추적.

```sql
CREATE TABLE abuse_prevention (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  event_type TEXT NOT NULL,               -- 'multiple_devices', 'rapid_logins', 'api_spam'
  event_data JSONB,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_abuse_user_id ON abuse_prevention(user_id);
CREATE INDEX idx_abuse_ip_address ON abuse_prevention(ip_address);
CREATE INDEX idx_abuse_event_type ON abuse_prevention(event_type);
CREATE INDEX idx_abuse_severity ON abuse_prevention(severity);
CREATE INDEX idx_abuse_is_resolved ON abuse_prevention(is_resolved);
CREATE INDEX idx_abuse_created_at ON abuse_prevention(created_at);
```

**컬럼 설명**:
- `user_id`: 사용자 ID (NULL 가능 - IP만으로 감지된 경우)
- `ip_address`: IP 주소
- `event_type`: 어뷰징 타입
- `event_data`: 상세 정보
- `severity`: 심각도
- `is_resolved`: 해결 여부
- `resolved_at`: 해결 시각
- `resolved_by`: 해결한 관리자 ID
- `notes`: 관리자 메모

**어뷰징 타입**:
- `multiple_devices`: 짧은 시간에 다수 기기 등록
- `rapid_logins`: 비정상적으로 많은 로그인 시도
- `api_spam`: API Rate Limit 초과
- `disposable_email`: 일회용 이메일 사용
- `device_id_manipulation`: 기기 ID 조작 의심
- `payment_fraud`: 결제 사기 의심

**event_data 예시**:
```json
{
  "devices_count": 10,
  "time_window": "1 hour",
  "device_ids": ["abc123", "def456", "..."]
}
```

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

### subscription_tiers 테이블

```sql
-- RLS 활성화
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

-- 정책 1: 모든 사용자가 활성 등급 조회 가능
CREATE POLICY "Everyone can view active tiers"
  ON subscription_tiers FOR SELECT
  USING (is_active = true);

-- 정책 2: 관리자만 수정 가능
CREATE POLICY "Only service role can modify tiers"
  ON subscription_tiers FOR ALL
  USING (auth.role() = 'service_role');
```

### feature_flags 테이블

```sql
-- RLS 활성화
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- 정책 1: 모든 사용자가 활성 기능 조회 가능
CREATE POLICY "Everyone can view enabled features"
  ON feature_flags FOR SELECT
  USING (is_enabled = true);

-- 정책 2: 관리자만 수정 가능
CREATE POLICY "Only service role can modify features"
  ON feature_flags FOR ALL
  USING (auth.role() = 'service_role');
```

### user_events 테이블

```sql
-- RLS 활성화
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- 정책 1: 본인 이벤트만 조회 가능
CREATE POLICY "Users can view own events"
  ON user_events FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 서버 함수만 삽입 가능
CREATE POLICY "Only service role can insert events"
  ON user_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 관리자는 모든 이벤트 조회 가능 (관리자 대시보드)
CREATE POLICY "Admins can view all events"
  ON user_events FOR SELECT
  USING (auth.role() = 'service_role');
```

### abuse_prevention 테이블

```sql
-- RLS 활성화
ALTER TABLE abuse_prevention ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자만 접근 가능
CREATE POLICY "Only service role can access abuse data"
  ON abuse_prevention FOR ALL
  USING (auth.role() = 'service_role');

-- 일반 사용자는 조회 불가 (보안)
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
