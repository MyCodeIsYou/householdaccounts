-- ============================================================
-- 18. 기본 가계부 설정
-- 로그인 시 자동 선택할 그룹을 저장 (NULL = 개인 가계부)
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_household_id UUID REFERENCES households(id) ON DELETE SET NULL;
