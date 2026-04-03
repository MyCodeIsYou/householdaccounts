-- ============================================================
-- 03. asset_snapshots (날짜별 총 자산 스냅샷)
-- ============================================================
CREATE TABLE asset_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_amount  NUMERIC(15,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

ALTER TABLE asset_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots: own data only"
  ON asset_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 계좌 잔액 변경 시 스냅샷 자동 갱신
CREATE OR REPLACE FUNCTION upsert_asset_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO asset_snapshots(user_id, snapshot_date, total_amount)
  SELECT NEW.user_id, CURRENT_DATE, COALESCE(SUM(balance), 0)
  FROM accounts
  WHERE user_id = NEW.user_id AND is_active = TRUE
  ON CONFLICT (user_id, snapshot_date)
  DO UPDATE SET total_amount = EXCLUDED.total_amount;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_on_account_change
  AFTER INSERT OR UPDATE OF balance, is_active ON accounts
  FOR EACH ROW EXECUTE FUNCTION upsert_asset_snapshot();
