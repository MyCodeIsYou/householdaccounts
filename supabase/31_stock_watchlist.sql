-- ============================================================
-- 31. 관심종목 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_watchlist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,
  name          TEXT NOT NULL,
  market        TEXT NOT NULL DEFAULT 'KOSPI',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_watchlist_unique
  ON stock_watchlist(user_id, symbol);

CREATE INDEX IF NOT EXISTS idx_stock_watchlist_user
  ON stock_watchlist(user_id, display_order);

ALTER TABLE stock_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_watchlist: household select"
  ON stock_watchlist FOR SELECT
  USING (household_id IN (SELECT my_household_ids()));

CREATE POLICY "stock_watchlist: own insert"
  ON stock_watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stock_watchlist: own delete"
  ON stock_watchlist FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "stock_watchlist: own update"
  ON stock_watchlist FOR UPDATE
  USING (auth.uid() = user_id);
