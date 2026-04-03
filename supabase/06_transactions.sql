-- ============================================================
-- 06. transactions (수입/지출 거래 원장)
-- ============================================================
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  txn_date        DATE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  memo            TEXT,
  payment_method  TEXT CHECK (payment_method IN ('현금','카드','계좌이체','자동이체','기타')),
  account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  card_id         UUID REFERENCES cards(id) ON DELETE SET NULL,
  is_allowance    BOOLEAN NOT NULL DEFAULT FALSE,
  is_fixed        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_txn_user_date   ON transactions(user_id, txn_date DESC);
CREATE INDEX idx_txn_user_month  ON transactions(user_id, DATE_TRUNC('month', txn_date));
CREATE INDEX idx_txn_category    ON transactions(user_id, category_id);
CREATE INDEX idx_txn_allowance   ON transactions(user_id, is_allowance) WHERE is_allowance = TRUE;
CREATE INDEX idx_txn_card        ON transactions(user_id, card_id) WHERE card_id IS NOT NULL;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: own data only"
  ON transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
