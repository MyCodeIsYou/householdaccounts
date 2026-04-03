-- ============================================================
-- 05. cards (신용/체크카드 정보)
-- ============================================================
CREATE TABLE cards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_name         TEXT NOT NULL,
  card_company      TEXT NOT NULL,
  last4             CHAR(4),
  billing_day       SMALLINT CHECK (billing_day BETWEEN 1 AND 31),
  linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cards: own data only"
  ON cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
