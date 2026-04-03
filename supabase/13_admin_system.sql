-- ============================================================
-- 13. 관리자 시스템 (app_role, is_super_admin, admin functions, menu_configs)
-- ============================================================

-- ── A. profiles 테이블에 app_role 추가 ────────────────────────
ALTER TABLE profiles
  ADD COLUMN app_role TEXT NOT NULL DEFAULT 'user'
  CHECK (app_role IN ('super_admin', 'admin', 'user'));

-- ── B. is_super_admin() 헬퍼 함수 ─────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND app_role = 'super_admin'
  );
$$;

-- ── C. profiles RLS 업데이트 ───────────────────────────────────
DROP POLICY IF EXISTS "profiles: own data only" ON profiles;

CREATE POLICY "profiles: select"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_super_admin());

CREATE POLICY "profiles: insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id OR is_super_admin());

-- ── D. 데이터 테이블 SELECT 정책에 OR is_super_admin() 추가 ────

-- accounts
DROP POLICY "accounts: own or household select" ON accounts;
CREATE POLICY "accounts: own or household select"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- transactions
DROP POLICY "transactions: own or household select" ON transactions;
CREATE POLICY "transactions: own or household select"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- cards
DROP POLICY "cards: own or household select" ON cards;
CREATE POLICY "cards: own or household select"
  ON cards FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- fixed_costs
DROP POLICY "fixed_costs: own or household select" ON fixed_costs;
CREATE POLICY "fixed_costs: own or household select"
  ON fixed_costs FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- fixed_cost_records
DROP POLICY "fixed_cost_records: own or household select" ON fixed_cost_records;
CREATE POLICY "fixed_cost_records: own or household select"
  ON fixed_cost_records FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- annual_plan
DROP POLICY "annual_plan: own or household select" ON annual_plan;
CREATE POLICY "annual_plan: own or household select"
  ON annual_plan FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- asset_snapshots
DROP POLICY "snapshots: own or household select" ON asset_snapshots;
CREATE POLICY "snapshots: own or household select"
  ON asset_snapshots FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

-- ── E. households / household_members SELECT 정책도 추가 ───────

DROP POLICY IF EXISTS "households: owner or member can read" ON households;
DROP POLICY IF EXISTS "households: member can read" ON households;
CREATE POLICY "households: owner or member can read"
  ON households FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "hm: member can read" ON household_members;
DROP POLICY IF EXISTS "hm: same group can read" ON household_members;
CREATE POLICY "hm: member can read"
  ON household_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  );

-- ── F. 관리자 전용 SECURITY DEFINER 함수 ──────────────────────

-- 전체 사용자 목록 (auth.users JOIN profiles + 그룹 멤버십)
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id                   UUID,
  email                TEXT,
  display_name         TEXT,
  app_role             TEXT,
  created_at           TIMESTAMPTZ,
  household_memberships JSONB
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email,
    p.display_name,
    p.app_role,
    p.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'household_id',   hm.household_id,
          'household_name', h.name,
          'role',           hm.role,
          'joined_at',      hm.joined_at
        )
      ) FILTER (WHERE hm.id IS NOT NULL),
      '[]'::jsonb
    ) AS household_memberships
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN household_members hm ON hm.user_id = p.id
  LEFT JOIN households h ON h.id = hm.household_id
  GROUP BY p.id, u.email, p.display_name, p.app_role, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;

-- 사용자 역할 변경
CREATE OR REPLACE FUNCTION admin_set_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_role NOT IN ('super_admin', 'admin', 'user') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;
  UPDATE profiles SET app_role = p_role WHERE id = p_user_id;
END;
$$;

-- ── G. menu_configs 테이블 ─────────────────────────────────────
CREATE TABLE menu_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key      TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  path          TEXT NOT NULL,
  icon_name     TEXT NOT NULL,
  min_role      TEXT NOT NULL DEFAULT 'user'
                CHECK (min_role IN ('super_admin', 'admin', 'user')),
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE menu_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_configs: authenticated read"
  ON menu_configs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "menu_configs: super_admin write"
  ON menu_configs FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON menu_configs TO authenticated;

-- ── H. 기존 10개 메뉴 시드 ────────────────────────────────────
INSERT INTO menu_configs (menu_key, label, path, icon_name, min_role, is_enabled, display_order) VALUES
  ('dashboard',       '대시보드',   '/',                'LayoutDashboard', 'user', true,  1),
  ('accounts',        '계좌 관리',   '/accounts',        'Wallet',          'user', true,  2),
  ('asset-chart',     '자산 변화',   '/asset-chart',     'TrendingUp',      'user', true,  3),
  ('annual-plan',     '연간 계획표', '/annual-plan',     'CalendarDays',    'user', true,  4),
  ('transactions',    '수입/지출',   '/transactions',    'FileText',        'user', true,  5),
  ('monthly-summary', '월별 합계',   '/monthly-summary', 'BarChart3',       'user', true,  6),
  ('allowance',       '용돈 관리',   '/allowance',       'Gift',            'user', true,  7),
  ('fixed-costs',     '고정비 관리', '/fixed-costs',     'Lock',            'user', true,  8),
  ('cards',           '카드 내역',   '/cards',           'CreditCard',      'user', true,  9),
  ('households',      '그룹 관리',   '/households',      'Users',           'user', true, 10)
ON CONFLICT (menu_key) DO NOTHING;

-- ============================================================
-- 실행 완료 후: 아래 쿼리로 본인 계정을 super_admin으로 설정
-- UPDATE profiles SET app_role = 'super_admin' WHERE id = '<내 UUID>';
-- ============================================================
