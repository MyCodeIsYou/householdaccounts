-- ============================================================
-- 19. asset_snapshots UNIQUE 제약 수정
-- 기존: UNIQUE(user_id, snapshot_date) — household_id 무시해서 충돌
-- 수정: user_id는 household_id IS NULL일 때만, household_id는 그룹 범위
-- ============================================================

-- 기존 UNIQUE 제약 제거
ALTER TABLE asset_snapshots
  DROP CONSTRAINT IF EXISTS asset_snapshots_user_id_snapshot_date_key;

-- 기존 household_id 제약도 일단 제거(이미 있으면)
ALTER TABLE asset_snapshots
  DROP CONSTRAINT IF EXISTS asset_snapshots_household_date_unique;

-- 개인 모드: household_id가 NULL일 때만 (user_id, snapshot_date) 유니크
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_personal_unique
  ON asset_snapshots (user_id, snapshot_date)
  WHERE household_id IS NULL;

-- 그룹 모드: household_id가 NOT NULL일 때만 (household_id, snapshot_date) 유니크
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_household_unique
  ON asset_snapshots (household_id, snapshot_date)
  WHERE household_id IS NOT NULL;

-- 자동 스냅샷 트리거 함수도 개인 데이터(household_id IS NULL)만 대상으로 수정
CREATE OR REPLACE FUNCTION upsert_asset_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    -- 개인 계좌 변경 → 개인 스냅샷 갱신
    INSERT INTO asset_snapshots(user_id, snapshot_date, total_amount, household_id)
    SELECT NEW.user_id, CURRENT_DATE, COALESCE(SUM(balance), 0), NULL
    FROM accounts
    WHERE user_id = NEW.user_id AND household_id IS NULL AND is_active = TRUE
    ON CONFLICT (user_id, snapshot_date) WHERE household_id IS NULL
    DO UPDATE SET total_amount = EXCLUDED.total_amount;
  ELSE
    -- 그룹 계좌 변경 → 그룹 스냅샷 갱신
    INSERT INTO asset_snapshots(user_id, snapshot_date, total_amount, household_id)
    SELECT NEW.user_id, CURRENT_DATE, COALESCE(SUM(balance), 0), NEW.household_id
    FROM accounts
    WHERE household_id = NEW.household_id AND is_active = TRUE
    ON CONFLICT (household_id, snapshot_date) WHERE household_id IS NOT NULL
    DO UPDATE SET total_amount = EXCLUDED.total_amount;
  END IF;
  RETURN NEW;
END;
$$;
