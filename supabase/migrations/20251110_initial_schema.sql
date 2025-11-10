-- =====================================================
-- 픽셀부스터 초기 데이터베이스 스키마
-- 작성일: 2025-11-10
-- 설명: 사용자 구독 관리, 기기 등록, 어필리에이트 시스템
-- =====================================================

-- =====================================================
-- 0. 헬퍼 함수: updated_at 자동 갱신
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. subscriptions 테이블 (구독 정보)
-- =====================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier TEXT CHECK (tier IN ('free', 'basic', 'pro')) NOT NULL DEFAULT 'free',
  status TEXT CHECK (status IN ('free', 'trial', 'active', 'expired', 'cancelled', 'suspended')) NOT NULL DEFAULT 'free',
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Stripe 관련 (향후 추가)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- MVP: 관리자 선물 기능
  granted_by UUID REFERENCES auth.users(id),
  payment_method TEXT CHECK (payment_method IN ('admin_grant', 'stripe')) DEFAULT 'admin_grant',
  grant_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_granted_by ON subscriptions(granted_by);

-- 유니크 제약: 사용자당 하나의 구독만
CREATE UNIQUE INDEX unique_user_subscription ON subscriptions(user_id);

-- 트리거: updated_at 자동 갱신
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only service role can modify subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 2. registered_devices 테이블 (등록된 기기)
-- =====================================================
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

-- RLS 정책
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON registered_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON registered_devices FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Only service role can insert devices"
  ON registered_devices FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 3. affiliates 테이블 (어필리에이트 파트너)
-- =====================================================
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

-- RLS 정책
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own affiliate data"
  ON affiliates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only service role can modify affiliates"
  ON affiliates FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 4. affiliate_referrals 테이블 (추천 기록)
-- =====================================================
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

-- RLS 정책
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own referrals"
  ON affiliate_referrals FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only service role can insert referrals"
  ON affiliate_referrals FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 5. revenue_logs 테이블 (수익 기록)
-- =====================================================
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

-- RLS 정책
ALTER TABLE revenue_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own revenue"
  ON revenue_logs FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only service role can insert revenue"
  ON revenue_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 6. subscription_tiers 테이블 (구독 등급 관리)
-- =====================================================
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name JSONB NOT NULL,
  description JSONB,
  features JSONB NOT NULL,
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

-- RLS 정책
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active tiers"
  ON subscription_tiers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Only service role can modify tiers"
  ON subscription_tiers FOR ALL
  USING (auth.role() = 'service_role');

-- 초기 데이터: 구독 등급
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

-- =====================================================
-- 7. feature_flags 테이블 (기능 플래그)
-- =====================================================
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name JSONB NOT NULL,
  description JSONB,
  min_tier_id UUID REFERENCES subscription_tiers(id),
  is_enabled BOOLEAN DEFAULT false,
  config JSONB,
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

-- RLS 정책
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view enabled features"
  ON feature_flags FOR SELECT
  USING (is_enabled = true);

CREATE POLICY "Only service role can modify features"
  ON feature_flags FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 8. user_events 테이블 (사용자 이벤트 로그)
-- =====================================================
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_event_type ON user_events(event_type);
CREATE INDEX idx_user_events_created_at ON user_events(created_at);
CREATE INDEX idx_user_events_ip_address ON user_events(ip_address);

-- RLS 정책
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON user_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only service role can insert events"
  ON user_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view all events"
  ON user_events FOR SELECT
  USING (auth.role() = 'service_role');

-- =====================================================
-- 9. abuse_prevention 테이블 (어뷰징 방지)
-- =====================================================
CREATE TABLE abuse_prevention (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  event_type TEXT NOT NULL,
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

-- RLS 정책
ALTER TABLE abuse_prevention ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access abuse data"
  ON abuse_prevention FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 완료 메시지
-- =====================================================
-- 모든 테이블, 인덱스, RLS 정책이 생성되었습니다.
-- 다음 단계: Supabase 대시보드 > SQL Editor에서 이 파일을 실행하세요.
