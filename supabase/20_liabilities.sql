-- ============================================================
-- 20. liabilities (부채 관리)
-- 계좌와 대칭적인 구조, 순자산 계산 시 차감
-- ============================================================

CREATE TABLE liabilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id  UUID REFERENCES households(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  liability_type TEXT NOT NULL DEFAULT '기타'
                 CHECK (liability_type IN ('주택담보', '전세자금', '신용대출', '마이너스통장', '카드론', '할부', '학자금', '기타')),
  creditor      TEXT,
  balance       NUMERIC(15,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(5,2),
  due_date      DATE,
  currency      TEXT NOT NULL DEFAULT 'KRW',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  memo          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liabilities_user ON liabilities(user_id) WHERE household_id IS NULL;
CREATE INDEX idx_liabilities_hh ON liabilities(household_id) WHERE household_id IS NOT NULL;

ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liabilities: select"
  ON liabilities FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "liabilities: insert"
  ON liabilities FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "liabilities: update"
  ON liabilities FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "liabilities: delete"
  ON liabilities FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON liabilities TO authenticated;

CREATE TRIGGER trg_liabilities_updated_at
  BEFORE UPDATE ON liabilities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 메뉴 추가
INSERT INTO menu_configs (menu_key, label, path, icon_name, min_role, is_enabled, display_order) VALUES
  ('liabilities', '부채 관리', '/liabilities', 'TrendingDown', 'user', true, 3)
ON CONFLICT (menu_key) DO NOTHING;
