-- ============================================================
-- 34. 그룹 공유 카테고리 + 기본/추가 구분
-- - categories.household_id : NULL = 개인, 값 = 그룹 공유 목록
-- - categories.is_default   : 시드 항목 true, 화면에서 추가한 항목 false
-- - 그룹 생성 시 기본 항목 시드
-- - 기존 그룹 거래/연간계획/고정비의 카테고리 ID를 그룹 목록으로 재연결
-- 개인 데이터(household_id IS NULL)의 ID는 바꾸지 않는다.
-- ============================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_categories_household
  ON categories (household_id)
  WHERE household_id IS NOT NULL;

-- ── 개인 항목 중 시드 이름과 같은 것은 기본 항목으로 표시 ───────────
UPDATE categories
SET is_default = TRUE
WHERE parent_id IS NULL;

UPDATE categories
SET is_default = TRUE
WHERE parent_id IS NOT NULL
  AND (plan_group, name) IN (
    ('근로수익', '급여'),
    ('근로수익', '상여금'),
    ('근로수익', '부업'),
    ('근로수익', '기타수입'),
    ('금융수익', '이자수익'),
    ('금융수익', '배당수익'),
    ('금융수익', '임대수익'),
    ('금융수익', '펀드수익'),
    ('고정비용', '주거비'),
    ('고정비용', '보험료'),
    ('고정비용', '통신비'),
    ('고정비용', '구독서비스'),
    ('고정비용', '교육비'),
    ('고정비용', '대출상환'),
    ('유동비용', '식비'),
    ('유동비용', '외식비'),
    ('유동비용', '교통비'),
    ('유동비용', '의류/미용'),
    ('유동비용', '의료/건강'),
    ('유동비용', '여가/취미'),
    ('유동비용', '용돈'),
    ('유동비용', '경조사'),
    ('유동비용', '쇼핑'),
    ('유동비용', '기타지출')
  );

-- ── 시드 트리 (개인 household_id NULL / 그룹 household_id 지정) ─────
CREATE OR REPLACE FUNCTION seed_default_category_tree(p_user_id UUID, p_household_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  top_id UUID;
BEGIN
  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default)
  VALUES (p_user_id, p_household_id, NULL, '근로수익', 'income', '근로수익', 1, TRUE)
  RETURNING id INTO top_id;
  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default) VALUES
    (p_user_id, p_household_id, top_id, '급여',     'income', '근로수익', 1, TRUE),
    (p_user_id, p_household_id, top_id, '상여금',   'income', '근로수익', 2, TRUE),
    (p_user_id, p_household_id, top_id, '부업',     'income', '근로수익', 3, TRUE),
    (p_user_id, p_household_id, top_id, '기타수입', 'income', '근로수익', 4, TRUE);

  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default)
  VALUES (p_user_id, p_household_id, NULL, '금융수익', 'income', '금융수익', 2, TRUE)
  RETURNING id INTO top_id;
  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default) VALUES
    (p_user_id, p_household_id, top_id, '이자수익', 'income', '금융수익', 1, TRUE),
    (p_user_id, p_household_id, top_id, '배당수익', 'income', '금융수익', 2, TRUE),
    (p_user_id, p_household_id, top_id, '임대수익', 'income', '금융수익', 3, TRUE),
    (p_user_id, p_household_id, top_id, '펀드수익', 'income', '금융수익', 4, TRUE);

  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default)
  VALUES (p_user_id, p_household_id, NULL, '고정비용', 'expense', '고정비용', 3, TRUE)
  RETURNING id INTO top_id;
  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default) VALUES
    (p_user_id, p_household_id, top_id, '주거비',     'expense', '고정비용', 1, TRUE),
    (p_user_id, p_household_id, top_id, '보험료',     'expense', '고정비용', 2, TRUE),
    (p_user_id, p_household_id, top_id, '통신비',     'expense', '고정비용', 3, TRUE),
    (p_user_id, p_household_id, top_id, '구독서비스', 'expense', '고정비용', 4, TRUE),
    (p_user_id, p_household_id, top_id, '교육비',     'expense', '고정비용', 5, TRUE),
    (p_user_id, p_household_id, top_id, '대출상환',   'expense', '고정비용', 6, TRUE);

  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default)
  VALUES (p_user_id, p_household_id, NULL, '유동비용', 'expense', '유동비용', 4, TRUE)
  RETURNING id INTO top_id;
  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default) VALUES
    (p_user_id, p_household_id, top_id, '식비',       'expense', '유동비용', 1, TRUE),
    (p_user_id, p_household_id, top_id, '외식비',     'expense', '유동비용', 2, TRUE),
    (p_user_id, p_household_id, top_id, '교통비',     'expense', '유동비용', 3, TRUE),
    (p_user_id, p_household_id, top_id, '의류/미용',  'expense', '유동비용', 4, TRUE),
    (p_user_id, p_household_id, top_id, '의료/건강',  'expense', '유동비용', 5, TRUE),
    (p_user_id, p_household_id, top_id, '여가/취미',  'expense', '유동비용', 6, TRUE),
    (p_user_id, p_household_id, top_id, '용돈',       'expense', '유동비용', 7, TRUE),
    (p_user_id, p_household_id, top_id, '경조사',     'expense', '유동비용', 8, TRUE),
    (p_user_id, p_household_id, top_id, '쇼핑',       'expense', '유동비용', 9, TRUE),
    (p_user_id, p_household_id, top_id, '기타지출',   'expense', '유동비용', 10, TRUE);
END $$;

CREATE OR REPLACE FUNCTION seed_default_categories_for_user(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  PERFORM seed_default_category_tree(p_user_id, NULL);
END $$;

CREATE OR REPLACE FUNCTION seed_default_categories_for_household(p_household_id UUID, p_owner_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- 마이그레이션(auth.uid() IS NULL)에서는 권한 검사를 건너뛴다.
  IF auth.uid() IS NOT NULL
     AND NOT is_super_admin()
     AND NOT EXISTS (
       SELECT 1 FROM household_members
       WHERE household_id = p_household_id AND user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION '그룹 멤버만 기본 항목을 만들 수 있습니다.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM categories
    WHERE household_id = p_household_id AND parent_id IS NULL
  ) THEN
    RETURN;
  END IF;

  PERFORM seed_default_category_tree(p_owner_id, p_household_id);
END $$;

REVOKE ALL ON FUNCTION seed_default_category_tree(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION seed_default_categories_for_household(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_default_categories_for_household(UUID, UUID) TO authenticated;

-- ── 개인 카테고리 → 그룹 카탈로그 (이름 + plan_group). 마이그레이션 전용 ──
CREATE OR REPLACE FUNCTION map_category_to_household(
  p_household_id UUID,
  p_owner_id UUID,
  p_category_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  src categories%ROWTYPE;
  matched_id UUID;
  parent UUID;
  new_id UUID;
BEGIN
  IF p_category_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO src FROM categories WHERE id = p_category_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF src.household_id = p_household_id THEN
    RETURN src.id;
  END IF;

  IF src.parent_id IS NULL THEN
    SELECT id INTO matched_id
    FROM categories
    WHERE household_id = p_household_id
      AND parent_id IS NULL
      AND plan_group = src.plan_group
    LIMIT 1;
    RETURN matched_id;
  END IF;

  matched_id := NULL;
  SELECT id INTO matched_id
  FROM categories
  WHERE household_id = p_household_id
    AND parent_id IS NOT NULL
    AND plan_group IS NOT DISTINCT FROM src.plan_group
    AND name = src.name
  LIMIT 1;
  IF matched_id IS NOT NULL THEN
    RETURN matched_id;
  END IF;

  SELECT id INTO parent
  FROM categories
  WHERE household_id = p_household_id
    AND parent_id IS NULL
    AND plan_group = src.plan_group
  LIMIT 1;
  IF parent IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO categories (user_id, household_id, parent_id, name, type, plan_group, display_order, is_default)
  VALUES (
    p_owner_id,
    p_household_id,
    parent,
    src.name,
    src.type,
    src.plan_group,
    COALESCE((SELECT MAX(display_order) + 1 FROM categories WHERE parent_id = parent), 1),
    FALSE
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION map_category_to_household(UUID, UUID, UUID) FROM PUBLIC;

-- ── 기존 그룹 데이터 재연결 ─────────────────────────────────────────
DO $$
DECLARE
  h RECORD;
  txn RECORD;
  plan_row RECORD;
  fc RECORD;
  new_cat UUID;
  new_sub UUID;
  existing_id UUID;
BEGIN
  FOR h IN SELECT id, owner_id FROM households LOOP
    PERFORM seed_default_categories_for_household(h.id, h.owner_id);

    FOR txn IN
      SELECT id, category_id, subcategory_id
      FROM transactions
      WHERE household_id = h.id
        AND (category_id IS NOT NULL OR subcategory_id IS NOT NULL)
    LOOP
      new_cat := map_category_to_household(h.id, h.owner_id, txn.category_id);
      new_sub := map_category_to_household(h.id, h.owner_id, txn.subcategory_id);
      IF new_cat IS DISTINCT FROM txn.category_id OR new_sub IS DISTINCT FROM txn.subcategory_id THEN
        UPDATE transactions
        SET category_id = CASE
              WHEN txn.category_id IS NULL THEN NULL
              ELSE COALESCE(new_cat, category_id)
            END,
            subcategory_id = CASE
              WHEN txn.subcategory_id IS NULL THEN NULL
              ELSE COALESCE(new_sub, subcategory_id)
            END
        WHERE id = txn.id;
      END IF;
    END LOOP;

    FOR plan_row IN SELECT * FROM annual_plan WHERE household_id = h.id LOOP
      IF NOT EXISTS (SELECT 1 FROM annual_plan WHERE id = plan_row.id) THEN
        CONTINUE;
      END IF;

      new_cat := map_category_to_household(h.id, h.owner_id, plan_row.category_id);
      IF new_cat IS NULL OR new_cat = plan_row.category_id THEN
        CONTINUE;
      END IF;

      SELECT id INTO existing_id
      FROM annual_plan
      WHERE household_id = h.id
        AND plan_year = plan_row.plan_year
        AND category_id = new_cat
        AND id <> plan_row.id;

      IF existing_id IS NOT NULL THEN
        UPDATE annual_plan
        SET
          jan = GREATEST(jan, plan_row.jan),
          feb = GREATEST(feb, plan_row.feb),
          mar = GREATEST(mar, plan_row.mar),
          apr = GREATEST(apr, plan_row.apr),
          may = GREATEST(may, plan_row.may),
          jun = GREATEST(jun, plan_row.jun),
          jul = GREATEST(jul, plan_row.jul),
          aug = GREATEST(aug, plan_row.aug),
          sep = GREATEST(sep, plan_row.sep),
          oct = GREATEST(oct, plan_row.oct),
          nov = GREATEST(nov, plan_row.nov),
          dec = GREATEST(dec, plan_row.dec)
        WHERE id = existing_id;
        DELETE FROM annual_plan WHERE id = plan_row.id;
      ELSE
        UPDATE annual_plan SET category_id = new_cat WHERE id = plan_row.id;
      END IF;
    END LOOP;

    FOR fc IN
      SELECT id, category_id FROM fixed_costs
      WHERE household_id = h.id AND category_id IS NOT NULL
    LOOP
      new_cat := map_category_to_household(h.id, h.owner_id, fc.category_id);
      IF new_cat IS NOT NULL AND new_cat IS DISTINCT FROM fc.category_id THEN
        UPDATE fixed_costs SET category_id = new_cat WHERE id = fc.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS map_category_to_household(UUID, UUID, UUID);

-- ── RLS: 개인은 본인, 그룹은 멤버 공유 ──────────────────────────────
DROP POLICY IF EXISTS "categories: own data only" ON categories;
DROP POLICY IF EXISTS "categories: select" ON categories;
DROP POLICY IF EXISTS "categories: insert" ON categories;
DROP POLICY IF EXISTS "categories: update" ON categories;
DROP POLICY IF EXISTS "categories: delete" ON categories;

CREATE POLICY "categories: select"
  ON categories FOR SELECT
  USING (
    (household_id IS NULL AND auth.uid() = user_id)
    OR household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  );

CREATE POLICY "categories: insert"
  ON categories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      household_id IS NULL
      OR household_id IN (SELECT my_household_ids())
    )
  );

CREATE POLICY "categories: update"
  ON categories FOR UPDATE
  USING (
    (household_id IS NULL AND auth.uid() = user_id)
    OR household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  )
  WITH CHECK (
    (household_id IS NULL AND auth.uid() = user_id)
    OR household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  );

CREATE POLICY "categories: delete"
  ON categories FOR DELETE
  USING (
    (household_id IS NULL AND auth.uid() = user_id)
    OR household_id IN (SELECT my_household_ids())
    OR is_super_admin()
  );

-- 상위 그룹 고정, 소유 범위(user_id/household_id) 변경 금지
CREATE OR REPLACE FUNCTION guard_category_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id THEN
    RAISE EXCEPTION '항목의 소유 범위는 바꿀 수 없습니다.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF OLD.parent_id IS NULL AND (
    NEW.name IS DISTINCT FROM OLD.name
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.plan_group IS DISTINCT FROM OLD.plan_group
    OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
  ) THEN
    RAISE EXCEPTION '상위 그룹은 변경할 수 없습니다.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_category_update ON categories;
CREATE TRIGGER trg_guard_category_update
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION guard_category_update();

-- 삭제 가드는 RLS에 가리지 않고 참조를 센다. 상위 그룹은 삭제 불가.
CREATE OR REPLACE FUNCTION block_category_delete_if_referenced()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  txn_count INT;
  fc_count  INT;
  child_count INT;
BEGIN
  IF OLD.parent_id IS NULL THEN
    RAISE EXCEPTION '상위 그룹은 삭제할 수 없습니다.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT COUNT(*) INTO child_count FROM categories WHERE parent_id = OLD.id;
  IF child_count > 0 THEN
    RAISE EXCEPTION '하위 카테고리 % 개가 있어 삭제할 수 없습니다. 먼저 하위 항목을 삭제하세요.', child_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT COUNT(*) INTO txn_count
  FROM transactions
  WHERE category_id = OLD.id OR subcategory_id = OLD.id;
  IF txn_count > 0 THEN
    RAISE EXCEPTION '연결된 거래 % 건이 있어 삭제할 수 없습니다.', txn_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT COUNT(*) INTO fc_count FROM fixed_costs WHERE category_id = OLD.id;
  IF fc_count > 0 THEN
    RAISE EXCEPTION '연결된 고정비 % 건이 있어 삭제할 수 없습니다.', fc_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END $$;
