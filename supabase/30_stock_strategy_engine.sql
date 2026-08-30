-- ============================================================
-- 30. 자동매매 엔진용 스키마 확장
-- ============================================================

-- 전략에 구조화된 조건 추가 (엔진이 코드로 판단할 수 있도록)
ALTER TABLE stock_strategies
  ADD COLUMN IF NOT EXISTS condition_type TEXT,
  ADD COLUMN IF NOT EXISTS condition_params JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qty INTEGER DEFAULT 1 CHECK (qty > 0),
  ADD COLUMN IF NOT EXISTS order_method TEXT DEFAULT 'market' CHECK (order_method IN ('limit', 'market')),
  ADD COLUMN IF NOT EXISTS last_signal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_order_id UUID REFERENCES stock_orders(id) ON DELETE SET NULL;

-- 주문 이력에 트리거 조건 메모 추가
ALTER TABLE stock_orders
  ADD COLUMN IF NOT EXISTS trigger_memo TEXT;

-- 자동매매 실행 로그
CREATE TABLE IF NOT EXISTS stock_trade_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES stock_strategies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  action      TEXT NOT NULL,
  detail      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_trade_logs_strategy ON stock_trade_logs(strategy_id, created_at DESC);

ALTER TABLE stock_trade_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_trade_logs: own select"
  ON stock_trade_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "stock_trade_logs: own insert"
  ON stock_trade_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
