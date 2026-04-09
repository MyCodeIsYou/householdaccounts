-- ============================================================
-- 25. 카테고리 사용자 관리 전환
-- - 시스템 카테고리(is_system=TRUE) 개념 제거
-- - 기존 사용자별로 시스템 카테고리를 본인 소유로 복사하고 FK 재연결
-- - 신규 가입 시 자동 시드 트리거
-- - 삭제 차단 트리거 (transactions/fixed_costs 참조 1건이라도 있으면 차단)
-- ============================================================

-- ── 1. 기존 사용자별로 시스템 카테고리 복사 + 외래키 재연결 ─────────
DO $$
DECLARE
  u           RECORD;
  top_old     RECORD;
  sub_old     RECORD;
  top_new_id  UUID;
  sub_new_id  UUID;
BEGIN
  FOR u IN SELECT id FROM profiles LOOP
    -- 최상위 카테고리(parent_id IS NULL) 복사
    FOR top_old IN
      SELECT id, name, type, plan_group, display_order
      FROM categories
      WHERE is_system = TRUE AND parent_id IS NULL
      ORDER BY display_order
    LOOP
      INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order)
      VALUES (u.id, NULL, top_old.name, top_old.type, top_old.plan_group, top_old.display_order)
      RETURNING id INTO top_new_id;

      -- 해당 사용자 데이터의 FK를 새 ID로 재연결
      UPDATE transactions SET category_id    = top_new_id WHERE user_id = u.id AND category_id    = top_old.id;
      UPDATE transactions SET subcategory_id = top_new_id WHERE user_id = u.id AND subcategory_id = top_old.id;
      UPDATE annual_plan  SET category_id    = top_new_id WHERE user_id = u.id AND category_id    = top_old.id;
      UPDATE fixed_costs  SET category_id    = top_new_id WHERE user_id = u.id AND category_id    = top_old.id;

      -- 하위 카테고리 복사
      FOR sub_old IN
        SELECT id, name, type, plan_group, display_order
        FROM categories
        WHERE is_system = TRUE AND parent_id = top_old.id
        ORDER BY display_order
      LOOP
        INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order)
        VALUES (u.id, top_new_id, sub_old.name, sub_old.type, sub_old.plan_group, sub_old.display_order)
        RETURNING id INTO sub_new_id;

        UPDATE transactions SET category_id    = sub_new_id WHERE user_id = u.id AND category_id    = sub_old.id;
        UPDATE transactions SET subcategory_id = sub_new_id WHERE user_id = u.id AND subcategory_id = sub_old.id;
        UPDATE annual_plan  SET category_id    = sub_new_id WHERE user_id = u.id AND category_id    = sub_old.id;
        UPDATE fixed_costs  SET category_id    = sub_new_id WHERE user_id = u.id AND category_id    = sub_old.id;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ── 2. 원본 시스템 카테고리 삭제 ─────────────────────────────────────
DELETE FROM categories WHERE is_system = TRUE;

-- ── 3. 기존 RLS 정책 제거 (is_system 컬럼 참조하므로 DROP COLUMN 전에 먼저 제거) ─
DROP POLICY IF EXISTS "categories: read system + own" ON categories;
DROP POLICY IF EXISTS "categories: insert own"        ON categories;
DROP POLICY IF EXISTS "categories: update own"        ON categories;
DROP POLICY IF EXISTS "categories: delete own"        ON categories;

-- ── 4. 스키마 정리 ───────────────────────────────────────────────────
ALTER TABLE categories DROP COLUMN is_system;
ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;

-- ── 5. 새 RLS 정책 ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "categories: own data only" ON categories;
CREATE POLICY "categories: own data only"
  ON categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. 디폴트 카테고리 시드 함수 (신규 가입 시 호출) ─────────────────
CREATE OR REPLACE FUNCTION seed_default_categories_for_user(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  top_id UUID;
BEGIN
  -- 근로수익
  INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order)
  VALUES (p_user_id, NULL, '근로수익', 'income', '근로수익', 1)
  RETURNING id INTO top_id;
  INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order) VALUES
    (p_user_id, top_id, '급여',     'income', '근로수익', 1),
    (p_user_id, top_id, '상여금',   'income', '근로수익', 2),
    (p_user_id, top_id, '부업',     'income', '근로수익', 3),
    (p_user_id, top_id, '기타수입', 'income', '근로수익', 4);

  -- 금융수익
  INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order)
  VALUES (p_user_id, NULL, '금융수익', 'income', '금융수익', 2)
  RETURNING id INTO top_id;
  INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order) VALUES
    (p_user_id, top_id, '이자수익', 'income', '금융수익', 1),
    (p_user_id, top_id, '배당수익', 'income', '금융수익', 2),
    (p_user_id, top_id, '임대수익', 'income', '금융수익', 3),
    (p_user_id, top_id, '펀드수익', 'income', '금융수익', 4);

  -- 고정비용
  INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order)
  VALUES (p_user_id, NULL, '고정비용', 'expense', '고정비용', 3)
  RETURNING id INTO top_id;
  INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order) VALUES
    (p_user_id, top_id, '주거비',     'expense', '고정비용', 1),
    (p_user_id, top_id, '보험료',     'expense', '고정비용', 2),
    (p_user_id, top_id, '통신비',     'expense', '고정비용', 3),
    (p_user_id, top_id, '구독서비스', 'expense', '고정비용', 4),
    (p_user_id, top_id, '교육비',     'expense', '고정비용', 5),
    (p_user_id, top_id, '대출상환',   'expense', '고정비용', 6);

  -- 유동비용
  INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order)
  VALUES (p_user_id, NULL, '유동비용', 'expense', '유동비용', 4)
  RETURNING id INTO top_id;
  INSERT INTO categories (user_id, parent_id, name, type, plan_group, display_order) VALUES
    (p_user_id, top_id, '식비',       'expense', '유동비용', 1),
    (p_user_id, top_id, '외식비',     'expense', '유동비용', 2),
    (p_user_id, top_id, '교통비',     'expense', '유동비용', 3),
    (p_user_id, top_id, '의류/미용',  'expense', '유동비용', 4),
    (p_user_id, top_id, '의료/건강',  'expense', '유동비용', 5),
    (p_user_id, top_id, '여가/취미',  'expense', '유동비용', 6),
    (p_user_id, top_id, '용돈',       'expense', '유동비용', 7),
    (p_user_id, top_id, '경조사',     'expense', '유동비용', 8),
    (p_user_id, top_id, '쇼핑',       'expense', '유동비용', 9),
    (p_user_id, top_id, '기타지출',   'expense', '유동비용', 10);
END $$;

-- ── 6. profiles 생성 시 자동 시드 트리거 ─────────────────────────────
CREATE OR REPLACE FUNCTION on_profile_created_seed_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  PERFORM seed_default_categories_for_user(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_categories_on_profile_insert ON profiles;
CREATE TRIGGER trg_seed_categories_on_profile_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION on_profile_created_seed_categories();

-- ── 7. 카테고리 삭제 차단 트리거 ──────────────────────────────────────
-- transactions/fixed_costs 에 1건이라도 참조가 있으면 RAISE EXCEPTION.
-- annual_plan은 단순 계획 수치이므로 ON DELETE CASCADE로 함께 삭제 허용.
CREATE OR REPLACE FUNCTION block_category_delete_if_referenced()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  txn_count INT;
  fc_count  INT;
  child_count INT;
BEGIN
  -- 하위 카테고리가 있는 경우 차단 (먼저 비우게 유도)
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

DROP TRIGGER IF EXISTS trg_block_category_delete ON categories;
CREATE TRIGGER trg_block_category_delete
  BEFORE DELETE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION block_category_delete_if_referenced();

-- ── 8. menu_configs에 카테고리 관리 메뉴 시드 ────────────────────────
INSERT INTO menu_configs (menu_key, label, path, icon_name, min_role, is_enabled, display_order)
VALUES ('categories', '카테고리 관리', '/categories', 'Tags', 'user', true, 10)
ON CONFLICT (menu_key) DO NOTHING;
