-- ============================================================
-- 32. account_snapshots (계좌별 자산 스냅샷)
-- asset_snapshots에 연결되어 계좌별 잔액 이력을 저장
-- ============================================================
CREATE TABLE account_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_snapshot_id UUID NOT NULL REFERENCES asset_snapshots(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 같은 스냅샷에 같은 계좌 중복 방지
CREATE UNIQUE INDEX idx_account_snapshots_unique
  ON account_snapshots (asset_snapshot_id, account_id);

ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS: asset_snapshot의 소유자만 접근 가능
CREATE POLICY "account_snapshots: via asset_snapshot owner"
  ON account_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM asset_snapshots s
      WHERE s.id = account_snapshots.asset_snapshot_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM asset_snapshots s
      WHERE s.id = account_snapshots.asset_snapshot_id
        AND s.user_id = auth.uid()
    )
  );

-- 트리거: 계좌 잔액 변경 시 계좌별 스냅샷도 자동 저장
CREATE OR REPLACE FUNCTION upsert_account_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_snapshot_id UUID;
BEGIN
  -- 해당 날짜의 asset_snapshot ID 조회
  IF NEW.household_id IS NULL THEN
    SELECT id INTO v_snapshot_id
    FROM asset_snapshots
    WHERE user_id = NEW.user_id
      AND household_id IS NULL
      AND snapshot_date = CURRENT_DATE;
  ELSE
    SELECT id INTO v_snapshot_id
    FROM asset_snapshots
    WHERE household_id = NEW.household_id
      AND snapshot_date = CURRENT_DATE;
  END IF;

  -- asset_snapshot이 있으면 계좌별 스냅샷도 upsert
  IF v_snapshot_id IS NOT NULL THEN
    INSERT INTO account_snapshots (asset_snapshot_id, account_id, amount)
    VALUES (v_snapshot_id, NEW.id, NEW.balance)
    ON CONFLICT (asset_snapshot_id, account_id)
    DO UPDATE SET amount = EXCLUDED.amount;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_snapshot_on_change
  AFTER INSERT OR UPDATE OF balance, is_active ON accounts
  FOR EACH ROW EXECUTE FUNCTION upsert_account_snapshot();
