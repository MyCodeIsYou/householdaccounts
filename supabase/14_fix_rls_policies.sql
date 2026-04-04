-- ============================================================
-- 14. RLS 정책 전체 수복 (SELECT + INSERT + UPDATE + DELETE)
-- super_admin은 모든 작업 가능, 안전하게 재실행 가능
-- ============================================================

-- ── Step 1: 헬퍼 함수 보장 ────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS app_role TEXT NOT NULL DEFAULT 'user'
  CHECK (app_role IN ('super_admin', 'admin', 'user'));

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND app_role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION my_household_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid();
$$;

-- ============================================================
-- 7개 데이터 테이블: SELECT / INSERT / UPDATE / DELETE 전부 재생성
-- 공통 패턴:
--   SELECT: own OR household member OR super_admin
--   INSERT: own (user_id = auth.uid()) OR super_admin
--   UPDATE: own OR household member OR super_admin
--   DELETE: own OR household member OR super_admin
-- ============================================================

-- ── accounts ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "accounts: own data only" ON accounts;
DROP POLICY IF EXISTS "accounts: own or household select" ON accounts;
DROP POLICY IF EXISTS "accounts: own insert" ON accounts;
DROP POLICY IF EXISTS "accounts: own or household update" ON accounts;
DROP POLICY IF EXISTS "accounts: own or household delete" ON accounts;

CREATE POLICY "accounts: select"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "accounts: insert"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "accounts: update"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "accounts: delete"
  ON accounts FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── transactions ─────────────────────────────────────────────
DROP POLICY IF EXISTS "transactions: own data only" ON transactions;
DROP POLICY IF EXISTS "transactions: own or household select" ON transactions;
DROP POLICY IF EXISTS "transactions: own insert" ON transactions;
DROP POLICY IF EXISTS "transactions: own or household update" ON transactions;
DROP POLICY IF EXISTS "transactions: own or household delete" ON transactions;

CREATE POLICY "transactions: select"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "transactions: insert"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "transactions: update"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "transactions: delete"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── cards ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cards: own data only" ON cards;
DROP POLICY IF EXISTS "cards: own or household select" ON cards;
DROP POLICY IF EXISTS "cards: own insert" ON cards;
DROP POLICY IF EXISTS "cards: own or household update" ON cards;
DROP POLICY IF EXISTS "cards: own or household delete" ON cards;

CREATE POLICY "cards: select"
  ON cards FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "cards: insert"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "cards: update"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "cards: delete"
  ON cards FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── fixed_costs ──────────────────────────────────────────────
DROP POLICY IF EXISTS "fixed_costs: own data only" ON fixed_costs;
DROP POLICY IF EXISTS "fixed_costs: own or household select" ON fixed_costs;
DROP POLICY IF EXISTS "fixed_costs: own insert" ON fixed_costs;
DROP POLICY IF EXISTS "fixed_costs: own or household update" ON fixed_costs;
DROP POLICY IF EXISTS "fixed_costs: own or household delete" ON fixed_costs;

CREATE POLICY "fixed_costs: select"
  ON fixed_costs FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "fixed_costs: insert"
  ON fixed_costs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "fixed_costs: update"
  ON fixed_costs FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "fixed_costs: delete"
  ON fixed_costs FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── fixed_cost_records ───────────────────────────────────────
DROP POLICY IF EXISTS "fixed_cost_records: own data only" ON fixed_cost_records;
DROP POLICY IF EXISTS "fixed_cost_records: own or household select" ON fixed_cost_records;
DROP POLICY IF EXISTS "fixed_cost_records: own insert" ON fixed_cost_records;
DROP POLICY IF EXISTS "fixed_cost_records: own or household update" ON fixed_cost_records;
DROP POLICY IF EXISTS "fixed_cost_records: own or household delete" ON fixed_cost_records;

CREATE POLICY "fixed_cost_records: select"
  ON fixed_cost_records FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "fixed_cost_records: insert"
  ON fixed_cost_records FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "fixed_cost_records: update"
  ON fixed_cost_records FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "fixed_cost_records: delete"
  ON fixed_cost_records FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── annual_plan ──────────────────────────────────────────────
DROP POLICY IF EXISTS "annual_plan: own data only" ON annual_plan;
DROP POLICY IF EXISTS "annual_plan: own or household select" ON annual_plan;
DROP POLICY IF EXISTS "annual_plan: own insert" ON annual_plan;
DROP POLICY IF EXISTS "annual_plan: own or household update" ON annual_plan;
DROP POLICY IF EXISTS "annual_plan: own or household delete" ON annual_plan;

CREATE POLICY "annual_plan: select"
  ON annual_plan FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "annual_plan: insert"
  ON annual_plan FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "annual_plan: update"
  ON annual_plan FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "annual_plan: delete"
  ON annual_plan FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── asset_snapshots ──────────────────────────────────────────
DROP POLICY IF EXISTS "snapshots: own data only" ON asset_snapshots;
DROP POLICY IF EXISTS "snapshots: own or household select" ON asset_snapshots;
DROP POLICY IF EXISTS "snapshots: own insert" ON asset_snapshots;
DROP POLICY IF EXISTS "snapshots: own or household update" ON asset_snapshots;
DROP POLICY IF EXISTS "snapshots: own or household delete" ON asset_snapshots;

CREATE POLICY "snapshots: select"
  ON asset_snapshots FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "snapshots: insert"
  ON asset_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "snapshots: update"
  ON asset_snapshots FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "snapshots: delete"
  ON asset_snapshots FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── households ───────────────────────────────────────────────
DROP POLICY IF EXISTS "households: owner or member can read" ON households;
DROP POLICY IF EXISTS "households: member can read" ON households;
CREATE POLICY "households: select"
  ON households FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
    OR is_super_admin()
  );

-- ── household_members ────────────────────────────────────────
DROP POLICY IF EXISTS "hm: member can read" ON household_members;
DROP POLICY IF EXISTS "hm: same group can read" ON household_members;
CREATE POLICY "hm: select"
  ON household_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  );

-- ── profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: select" ON profiles;
DROP POLICY IF EXISTS "profiles: own data only" ON profiles;
CREATE POLICY "profiles: select"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR id IN (SELECT user_id FROM household_members WHERE household_id IN (SELECT my_household_ids()))
    OR is_super_admin()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles: insert'
  ) THEN
    CREATE POLICY "profiles: insert"
      ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles: update'
  ) THEN
    CREATE POLICY "profiles: update"
      ON profiles FOR UPDATE USING (auth.uid() = id OR is_super_admin());
  END IF;
END;
$$;

-- ── 확인용 ───────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE 'RLS 정책 전체 수복 완료 (SELECT + INSERT + UPDATE + DELETE)';
  RAISE NOTICE '확인: SELECT tablename, policyname, cmd FROM pg_policies ORDER BY tablename, cmd;';
END; $$;
