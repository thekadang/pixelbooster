-- =====================================================
-- 기기 등록 RLS 정책 수정
-- 작성일: 2025-11-11
-- 설명: Edge Function에서 기기 등록 가능하도록 정책 수정
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Only service role can insert devices" ON registered_devices;

-- 새로운 정책: Edge Function에서 인증된 사용자가 자신의 기기를 등록할 수 있도록 허용
CREATE POLICY "Authenticated users can insert own devices"
  ON registered_devices FOR INSERT
  WITH CHECK (
    -- service_role이거나
    auth.role() = 'service_role'
    OR
    -- 인증된 사용자가 자신의 기기를 등록하는 경우
    (auth.uid() = user_id AND auth.role() = 'authenticated')
  );

-- =====================================================
-- 완료 메시지
-- =====================================================
-- RLS 정책이 수정되었습니다.
-- 이제 Edge Function에서 기기를 등록할 수 있습니다.
