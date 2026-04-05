-- ============================================================
-- 17. households + household_members 전체 RLS 정책 재정비
-- 재귀 완전 제거: SECURITY DEFINER 함수만 사용
-- ============================================================

-- ── 헬퍼 함수: 내가 오너인 household_id 목록 (SECURITY DEFINER) ─
CREATE OR REPLACE FUNCTION my_owned_household_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id FROM households WHERE owner_id = auth.uid();
$$;

-- ── 탈퇴 RPC (RLS 완전 우회) ────────────────────────────────
CREATE OR REPLACE FUNCTION leave_household(p_household_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM household_members
  WHERE household_id = p_household_id AND user_id = auth.uid();
END;
$$;

-- ── 멤버 제거 RPC (오너 또는 super_admin만) ─────────────────
CREATE OR REPLACE FUNCTION remove_household_member(p_household_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT owner_id INTO v_owner FROM households WHERE id = p_household_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Household not found';
  END IF;
  IF v_owner != auth.uid() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- 오너는 제거 불가
  IF p_user_id = v_owner THEN
    RAISE EXCEPTION 'Cannot remove owner';
  END IF;
  DELETE FROM household_members
  WHERE household_id = p_household_id AND user_id = p_user_id;
END;
$$;

-- ── households ──────────────────────────────────────────────
DROP POLICY IF EXISTS "households: member can read" ON households;
DROP POLICY IF EXISTS "households: owner or member can read" ON households;
DROP POLICY IF EXISTS "households: select" ON households;
DROP POLICY IF EXISTS "households: owner can insert" ON households;
DROP POLICY IF EXISTS "households: owner can update" ON households;
DROP POLICY IF EXISTS "households: owner can delete" ON households;
DROP POLICY IF EXISTS "households: insert" ON households;
DROP POLICY IF EXISTS "households: update" ON households;
DROP POLICY IF EXISTS "households: delete" ON households;

CREATE POLICY "households: select"
  ON households FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT my_household_ids())
    OR is_super_admin()
  );
CREATE POLICY "households: insert"
  ON households FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR is_super_admin());
CREATE POLICY "households: update"
  ON households FOR UPDATE
  USING (auth.uid() = owner_id OR is_super_admin());
CREATE POLICY "households: delete"
  ON households FOR DELETE
  USING (auth.uid() = owner_id OR is_super_admin());

-- ── household_members (재귀 방지 — 다른 테이블 참조 금지) ────
DROP POLICY IF EXISTS "hm: same group can read" ON household_members;
DROP POLICY IF EXISTS "hm: member can read" ON household_members;
DROP POLICY IF EXISTS "hm: select" ON household_members;
DROP POLICY IF EXISTS "hm: self insert" ON household_members;
DROP POLICY IF EXISTS "hm: insert" ON household_members;
DROP POLICY IF EXISTS "hm: owner or self delete" ON household_members;
DROP POLICY IF EXISTS "hm: delete" ON household_members;

CREATE POLICY "hm: select"
  ON household_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  );

CREATE POLICY "hm: insert"
  ON household_members FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());

-- DELETE: 본인 탈퇴 + 오너가 멤버 제거(SECURITY DEFINER 함수로) + super_admin
-- 여기서 my_owned_household_ids()를 사용해서 households 테이블 참조 없이 처리
CREATE POLICY "hm: delete"
  ON household_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR is_super_admin()
    OR household_id IN (SELECT my_owned_household_ids())
  );

-- ── household_invites ───────────────────────────────────────
DROP POLICY IF EXISTS "hi: member can read" ON household_invites;
DROP POLICY IF EXISTS "hi: select" ON household_invites;
DROP POLICY IF EXISTS "hi: owner can insert" ON household_invites;
DROP POLICY IF EXISTS "hi: insert" ON household_invites;
DROP POLICY IF EXISTS "hi: owner can update" ON household_invites;
DROP POLICY IF EXISTS "hi: update" ON household_invites;
DROP POLICY IF EXISTS "hi: delete" ON household_invites;

CREATE POLICY "hi: select"
  ON household_invites FOR SELECT
  USING (
    household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  );
CREATE POLICY "hi: insert"
  ON household_invites FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR household_id IN (SELECT my_owned_household_ids())
  );
CREATE POLICY "hi: update"
  ON household_invites FOR UPDATE
  USING (
    is_super_admin()
    OR household_id IN (SELECT my_owned_household_ids())
  );
CREATE POLICY "hi: delete"
  ON household_invites FOR DELETE
  USING (
    is_super_admin()
    OR household_id IN (SELECT my_owned_household_ids())
  );
