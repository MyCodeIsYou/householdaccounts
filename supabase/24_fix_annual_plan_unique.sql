-- ============================================================
-- 24. annual_plan UNIQUE 제약 수정
-- 기존: UNIQUE(user_id, plan_year, category_id) — household_id 무시해서
--       개인/가구 모드 전환 시 같은 (user, year, category) 입력하면 23505 충돌
-- 수정: 개인 모드는 user_id 기준, 가구 모드는 household_id 기준으로 분리
-- (asset_snapshots 19_fix_snapshot_unique.sql 와 동일 패턴)
-- ============================================================

-- 기존 UNIQUE 제약 제거
ALTER TABLE annual_plan
  DROP CONSTRAINT IF EXISTS annual_plan_user_id_plan_year_category_id_key;

-- 개인 모드: household_id가 NULL일 때만 (user_id, plan_year, category_id) 유니크
CREATE UNIQUE INDEX IF NOT EXISTS idx_annual_plan_personal_unique
  ON annual_plan (user_id, plan_year, category_id)
  WHERE household_id IS NULL;

-- 가구 모드: household_id가 NOT NULL일 때만 (household_id, plan_year, category_id) 유니크
CREATE UNIQUE INDEX IF NOT EXISTS idx_annual_plan_household_unique
  ON annual_plan (household_id, plan_year, category_id)
  WHERE household_id IS NOT NULL;
