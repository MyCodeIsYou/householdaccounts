-- ============================================================
-- 12. 헬퍼 함수 + 기존 RLS 정책 업데이트
-- 개인 데이터(user_id) OR 그룹 데이터(household_id) 모두 접근 가능
-- ============================================================

-- 헬퍼: 현재 사용자가 속한 household_id 집합 반환 (반복 방지)
CREATE OR REPLACE FUNCTION my_household_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid();
$$;

-- ── accounts ──────────────────────────────────────────────────
DROP POLICY "accounts: own data only" ON accounts;

CREATE POLICY "accounts: own or household select"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "accounts: own insert"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts: own or household update"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "accounts: own or household delete"
  ON accounts FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── transactions ──────────────────────────────────────────────
DROP POLICY "transactions: own data only" ON transactions;

CREATE POLICY "transactions: own or household select"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "transactions: own insert"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: own or household update"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "transactions: own or household delete"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── cards ──────────────────────────────────────────────────────
DROP POLICY "cards: own data only" ON cards;

CREATE POLICY "cards: own or household select"
  ON cards FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "cards: own insert"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards: own or household update"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "cards: own or household delete"
  ON cards FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── fixed_costs ────────────────────────────────────────────────
DROP POLICY "fixed_costs: own data only" ON fixed_costs;

CREATE POLICY "fixed_costs: own or household select"
  ON fixed_costs FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "fixed_costs: own insert"
  ON fixed_costs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fixed_costs: own or household update"
  ON fixed_costs FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "fixed_costs: own or household delete"
  ON fixed_costs FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── fixed_cost_records ─────────────────────────────────────────
DROP POLICY "fixed_cost_records: own data only" ON fixed_cost_records;

CREATE POLICY "fixed_cost_records: own or household select"
  ON fixed_cost_records FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "fixed_cost_records: own insert"
  ON fixed_cost_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fixed_cost_records: own or household update"
  ON fixed_cost_records FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "fixed_cost_records: own or household delete"
  ON fixed_cost_records FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── annual_plan ────────────────────────────────────────────────
DROP POLICY "annual_plan: own data only" ON annual_plan;

CREATE POLICY "annual_plan: own or household select"
  ON annual_plan FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "annual_plan: own insert"
  ON annual_plan FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "annual_plan: own or household update"
  ON annual_plan FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "annual_plan: own or household delete"
  ON annual_plan FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ── asset_snapshots ────────────────────────────────────────────
DROP POLICY "snapshots: own data only" ON asset_snapshots;

CREATE POLICY "snapshots: own or household select"
  ON asset_snapshots FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "snapshots: own insert"
  ON asset_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "snapshots: own or household update"
  ON asset_snapshots FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

CREATE POLICY "snapshots: own or household delete"
  ON asset_snapshots FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()));

-- ============================================================
-- 초대 토큰으로 그룹 합류 (SECURITY DEFINER — RLS 우회)
-- ============================================================
CREATE OR REPLACE FUNCTION join_household_by_token(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_invite  household_invites;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT * INTO v_invite
  FROM household_invites
  WHERE token = p_token
    AND is_active = TRUE
    AND expires_at > now()
    AND used_count < max_uses;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_or_expired_token');
  END IF;

  -- 이미 멤버이면 SKIP
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (v_invite.household_id, v_user_id, 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  -- 사용 횟수 증가
  UPDATE household_invites
  SET used_count = used_count + 1
  WHERE id = v_invite.id;

  RETURN json_build_object(
    'success', true,
    'household_id', v_invite.household_id
  );
END;
$$;

-- 토큰 미인증 조회용 (JoinPage에서 그룹 이름 미리보기)
CREATE OR REPLACE FUNCTION peek_invite_token(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_household_id UUID;
  v_name         TEXT;
  v_expires_at   TIMESTAMPTZ;
BEGIN
  SELECT hi.household_id, h.name, hi.expires_at
    INTO v_household_id, v_name, v_expires_at
  FROM household_invites hi
  JOIN households h ON h.id = hi.household_id
  WHERE hi.token = p_token
    AND hi.is_active = TRUE
    AND hi.expires_at > now()
    AND hi.used_count < hi.max_uses;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_or_expired_token');
  END IF;

  RETURN json_build_object(
    'household_name', v_name,
    'household_id', v_household_id,
    'expires_at', v_expires_at
  );
END;
$$;
