-- ============================================================
-- 28. 주식 기능 테이블 (자동매매 전략, 데이터 수집, 시세/재무/투자자 데이터)
-- ============================================================

-- ── 1. 자동매매 전략 ─────────────────────────────────────────
CREATE TABLE stock_strategies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id    UUID REFERENCES households(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'both')),
  status          TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('running', 'stopped')),
  condition       TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_strategies_user ON stock_strategies(user_id);

ALTER TABLE stock_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_strategies: own or household select"
  ON stock_strategies FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "stock_strategies: own insert"
  ON stock_strategies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_strategies: own or household update"
  ON stock_strategies FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "stock_strategies: own or household delete"
  ON stock_strategies FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── 2. 데이터 수집 작업 ──────────────────────────────────────
CREATE TABLE stock_collection_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id    UUID REFERENCES households(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('daily_price', 'financial', 'investor')),
  symbols         TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'error')),
  last_run        TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_collection_jobs_user ON stock_collection_jobs(user_id);

ALTER TABLE stock_collection_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_collection_jobs: own or household select"
  ON stock_collection_jobs FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "stock_collection_jobs: own insert"
  ON stock_collection_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_collection_jobs: own or household update"
  ON stock_collection_jobs FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "stock_collection_jobs: own or household delete"
  ON stock_collection_jobs FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── 3. 일별 시세 데이터 ──────────────────────────────────────
CREATE TABLE stock_daily_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES stock_collection_jobs(id) ON DELETE SET NULL,
  symbol          TEXT NOT NULL,
  bsop_date       DATE NOT NULL,
  open_price      NUMERIC(15,2) NOT NULL,
  high_price      NUMERIC(15,2) NOT NULL,
  low_price       NUMERIC(15,2) NOT NULL,
  close_price     NUMERIC(15,2) NOT NULL,
  volume          BIGINT NOT NULL DEFAULT 0,
  change_amount   NUMERIC(15,2),
  change_sign     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (symbol, bsop_date)
);

CREATE INDEX idx_stock_daily_prices_symbol_date ON stock_daily_prices(symbol, bsop_date DESC);
CREATE INDEX idx_stock_daily_prices_user ON stock_daily_prices(user_id);

ALTER TABLE stock_daily_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_daily_prices: own select"
  ON stock_daily_prices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "stock_daily_prices: own insert"
  ON stock_daily_prices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_daily_prices: own delete"
  ON stock_daily_prices FOR DELETE
  USING (auth.uid() = user_id);

-- ── 4. 재무비율 데이터 ───────────────────────────────────────
CREATE TABLE stock_financials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES stock_collection_jobs(id) ON DELETE SET NULL,
  symbol          TEXT NOT NULL,
  fiscal_ym       TEXT NOT NULL,
  revenue_growth  NUMERIC(10,2),
  op_profit_growth NUMERIC(10,2),
  net_income_growth NUMERIC(10,2),
  roe             NUMERIC(10,2),
  eps             NUMERIC(15,2),
  sps             NUMERIC(15,2),
  bps             NUMERIC(15,2),
  reserve_rate    NUMERIC(10,2),
  debt_rate       NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (symbol, fiscal_ym)
);

CREATE INDEX idx_stock_financials_symbol ON stock_financials(symbol, fiscal_ym);
CREATE INDEX idx_stock_financials_user ON stock_financials(user_id);

ALTER TABLE stock_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_financials: own select"
  ON stock_financials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "stock_financials: own insert"
  ON stock_financials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_financials: own delete"
  ON stock_financials FOR DELETE
  USING (auth.uid() = user_id);

-- ── 5. 투자자별 매매동향 데이터 ──────────────────────────────
CREATE TABLE stock_investor_trends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES stock_collection_jobs(id) ON DELETE SET NULL,
  symbol          TEXT NOT NULL,
  bsop_date       DATE NOT NULL,
  individual_qty  BIGINT DEFAULT 0,
  foreign_qty     BIGINT DEFAULT 0,
  institution_qty BIGINT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (symbol, bsop_date)
);

CREATE INDEX idx_stock_investor_trends_symbol_date ON stock_investor_trends(symbol, bsop_date DESC);
CREATE INDEX idx_stock_investor_trends_user ON stock_investor_trends(user_id);

ALTER TABLE stock_investor_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_investor_trends: own select"
  ON stock_investor_trends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "stock_investor_trends: own insert"
  ON stock_investor_trends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_investor_trends: own delete"
  ON stock_investor_trends FOR DELETE
  USING (auth.uid() = user_id);

-- ── 6. 주문 이력 ─────────────────────────────────────────────
CREATE TABLE stock_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id    UUID REFERENCES households(id) ON DELETE SET NULL,
  strategy_id     UUID REFERENCES stock_strategies(id) ON DELETE SET NULL,
  symbol          TEXT NOT NULL,
  order_type      TEXT NOT NULL CHECK (order_type IN ('buy', 'sell')),
  order_method    TEXT NOT NULL DEFAULT 'limit' CHECK (order_method IN ('limit', 'market')),
  qty             INTEGER NOT NULL CHECK (qty > 0),
  price           NUMERIC(15,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partial', 'cancelled', 'failed')),
  kis_order_no    TEXT,
  error           TEXT,
  ordered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  filled_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_orders_user ON stock_orders(user_id, ordered_at DESC);
CREATE INDEX idx_stock_orders_strategy ON stock_orders(strategy_id) WHERE strategy_id IS NOT NULL;

ALTER TABLE stock_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_orders: own or household select"
  ON stock_orders FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "stock_orders: own insert"
  ON stock_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_orders: own or household update"
  ON stock_orders FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── 7. updated_at 트리거 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_stock_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_strategies_updated
  BEFORE UPDATE ON stock_strategies
  FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

CREATE TRIGGER trg_stock_collection_jobs_updated
  BEFORE UPDATE ON stock_collection_jobs
  FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();
