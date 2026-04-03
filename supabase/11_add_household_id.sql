-- ============================================================
-- 11. 기존 테이블에 household_id 컬럼 추가
-- NULL = 개인 데이터 (기존 데이터 유지), UUID = 그룹 데이터
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;

ALTER TABLE transactions
  ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;

ALTER TABLE cards
  ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;

ALTER TABLE fixed_costs
  ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;

ALTER TABLE fixed_cost_records
  ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;

ALTER TABLE annual_plan
  ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;

ALTER TABLE asset_snapshots
  ADD COLUMN household_id UUID REFERENCES households(id) ON DELETE SET NULL;

-- 그룹 스냅샷용 UNIQUE 제약 (기존 user_id+snapshot_date UNIQUE는 유지)
ALTER TABLE asset_snapshots
  ADD CONSTRAINT asset_snapshots_household_date_unique
  UNIQUE (household_id, snapshot_date);

-- 성능 인덱스
CREATE INDEX idx_accounts_hh       ON accounts(household_id)        WHERE household_id IS NOT NULL;
CREATE INDEX idx_transactions_hh   ON transactions(household_id)     WHERE household_id IS NOT NULL;
CREATE INDEX idx_cards_hh          ON cards(household_id)            WHERE household_id IS NOT NULL;
CREATE INDEX idx_fixed_costs_hh    ON fixed_costs(household_id)      WHERE household_id IS NOT NULL;
CREATE INDEX idx_fcrecords_hh      ON fixed_cost_records(household_id) WHERE household_id IS NOT NULL;
CREATE INDEX idx_annual_plan_hh    ON annual_plan(household_id)      WHERE household_id IS NOT NULL;
CREATE INDEX idx_snapshots_hh      ON asset_snapshots(household_id)  WHERE household_id IS NOT NULL;
