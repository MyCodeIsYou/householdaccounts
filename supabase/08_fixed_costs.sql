-- ============================================================
-- 08. fixed_costs + fixed_cost_records (고정비 관리)
-- ============================================================
CREATE TABLE fixed_costs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
  expected_amount  NUMERIC(15,2) NOT NULL,
  billing_day      SMALLINT CHECK (billing_day BETWEEN 1 AND 31),
  payment_method   TEXT CHECK (payment_method IN ('현금','카드','계좌이체','자동이체','기타')),
  card_id          UUID REFERENCES cards(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fixed_cost_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fixed_cost_id   UUID NOT NULL REFERENCES fixed_costs(id) ON DELETE CASCADE,
  record_year     SMALLINT NOT NULL,
  record_month    SMALLINT NOT NULL CHECK (record_month BETWEEN 1 AND 12),
  actual_amount   NUMERIC(15,2),
  transaction_id  UUID REFERENCES transactions(id) ON DELETE SET NULL,
  is_paid         BOOLEAN NOT NULL DEFAULT FALSE,
  paid_date       DATE,
  UNIQUE (fixed_cost_id, record_year, record_month)
);

ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_cost_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_costs: own data only"
  ON fixed_costs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fixed_cost_records: own data only"
  ON fixed_cost_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
