-- ============================================================
-- 14. RLS 정책 수정 (migration 13 부분 실행 문제 복구)
-- 모든 DROP IF EXISTS + CREATE 패턴으로 안전하게 재실행 가능
-- ============================================================

-- ── Step 1: profiles.app_role 컬럼 보장 ────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS app_role TEXT NOT NULL DEFAULT 'user'
  CHECK (app_role IN ('super_admin', 'admin', 'user'));

-- ── Step 2: is_super_admin() 함수 재생성 ──────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND app_role = 'super_admin'
  );
$$;

-- ── Step 3: my_household_ids() 함수 재생성 ────────────────
CREATE OR REPLACE FUNCTION my_household_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid();
$$;

-- ── Step 4: accounts SELECT 정책 재생성 ──────────────────
DROP POLICY IF EXISTS "accounts: own or household select" ON accounts;
CREATE POLICY "accounts: own or household select"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── Step 5: transactions SELECT 정책 재생성 ───────────────
DROP POLICY IF EXISTS "transactions: own or household select" ON transactions;
CREATE POLICY "transactions: own or household select"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── Step 6: cards SELECT 정책 재생성 ─────────────────────
DROP POLICY IF EXISTS "cards: own or household select" ON cards;
CREATE POLICY "cards: own or household select"
  ON cards FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── Step 7: fixed_costs SELECT 정책 재생성 ────────────────
DROP POLICY IF EXISTS "fixed_costs: own or household select" ON fixed_costs;
CREATE POLICY "fixed_costs: own or household select"
  ON fixed_costs FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── Step 8: fixed_cost_records SELECT 정책 재생성 ─────────
DROP POLICY IF EXISTS "fixed_cost_records: own or household select" ON fixed_cost_records;
CREATE POLICY "fixed_cost_records: own or household select"
  ON fixed_cost_records FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── Step 9: annual_plan SELECT 정책 재생성 ────────────────
DROP POLICY IF EXISTS "annual_plan: own or household select" ON annual_plan;
CREATE POLICY "annual_plan: own or household select"
  ON annual_plan FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── Step 10: asset_snapshots SELECT 정책 재생성 ───────────
DROP POLICY IF EXISTS "snapshots: own or household select" ON asset_snapshots;
CREATE POLICY "snapshots: own or household select"
  ON asset_snapshots FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── Step 11: households SELECT 정책 재생성 ────────────────
DROP POLICY IF EXISTS "households: owner or member can read" ON households;
DROP POLICY IF EXISTS "households: member can read" ON households;
CREATE POLICY "households: owner or member can read"
  ON households FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
    OR is_super_admin()
  );

-- ── Step 12: household_members SELECT 정책 재생성 ─────────
DROP POLICY IF EXISTS "hm: member can read" ON household_members;
DROP POLICY IF EXISTS "hm: same group can read" ON household_members;
CREATE POLICY "hm: member can read"
  ON household_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  );

-- ── Step 13: profiles SELECT 정책 재생성 ─────────────────
DROP POLICY IF EXISTS "profiles: select" ON profiles;
DROP POLICY IF EXISTS "profiles: own data only" ON profiles;
CREATE POLICY "profiles: select"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR id IN (SELECT user_id FROM household_members WHERE household_id IN (SELECT my_household_ids()))
    OR is_super_admin()
  );

-- profiles INSERT/UPDATE (없으면 생성)
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

-- ── 완료 메시지 ───────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE 'RLS 정책 수복 완료. 아래 쿼리로 결과를 확인하세요:';
  RAISE NOTICE 'SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN (''accounts'', ''transactions'', ''cards'', ''asset_snapshots'') ORDER BY tablename, cmd;';
END; $$;
