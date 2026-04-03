-- ============================================================
-- 04. categories (수입/지출 카테고리 + 시스템 시드)
-- ============================================================
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('income','expense')),
  plan_group    TEXT CHECK (plan_group IN ('근로수익','금융수익','고정비용','유동비용')),
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories: read system + own"
  ON categories FOR SELECT
  USING (is_system = TRUE OR auth.uid() = user_id);

CREATE POLICY "categories: insert own"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories: update own"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "categories: delete own"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- ── 시스템 기본 카테고리 시드 (최상위) ──────────────────────
INSERT INTO categories(id, name, type, plan_group, is_system, display_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', '근로수익', 'income', '근로수익', TRUE, 1),
  ('c1000000-0000-0000-0000-000000000002', '금융수익', 'income', '금융수익', TRUE, 2),
  ('c2000000-0000-0000-0000-000000000001', '고정비용', 'expense', '고정비용', TRUE, 3),
  ('c2000000-0000-0000-0000-000000000002', '유동비용', 'expense', '유동비용', TRUE, 4);

-- ── 근로수익 하위 ────────────────────────────────────────────
INSERT INTO categories(name, type, plan_group, parent_id, is_system, display_order) VALUES
  ('급여',    'income', '근로수익', 'c1000000-0000-0000-0000-000000000001', TRUE, 1),
  ('상여금',  'income', '근로수익', 'c1000000-0000-0000-0000-000000000001', TRUE, 2),
  ('부업',    'income', '근로수익', 'c1000000-0000-0000-0000-000000000001', TRUE, 3),
  ('기타수입','income', '근로수익', 'c1000000-0000-0000-0000-000000000001', TRUE, 4);

-- ── 금융수익 하위 ────────────────────────────────────────────
INSERT INTO categories(name, type, plan_group, parent_id, is_system, display_order) VALUES
  ('이자수익', 'income', '금융수익', 'c1000000-0000-0000-0000-000000000002', TRUE, 1),
  ('배당수익', 'income', '금융수익', 'c1000000-0000-0000-0000-000000000002', TRUE, 2),
  ('임대수익', 'income', '금융수익', 'c1000000-0000-0000-0000-000000000002', TRUE, 3),
  ('펀드수익', 'income', '금융수익', 'c1000000-0000-0000-0000-000000000002', TRUE, 4);

-- ── 고정비용 하위 ────────────────────────────────────────────
INSERT INTO categories(name, type, plan_group, parent_id, is_system, display_order) VALUES
  ('주거비',     'expense', '고정비용', 'c2000000-0000-0000-0000-000000000001', TRUE, 1),
  ('보험료',     'expense', '고정비용', 'c2000000-0000-0000-0000-000000000001', TRUE, 2),
  ('통신비',     'expense', '고정비용', 'c2000000-0000-0000-0000-000000000001', TRUE, 3),
  ('구독서비스', 'expense', '고정비용', 'c2000000-0000-0000-0000-000000000001', TRUE, 4),
  ('교육비',     'expense', '고정비용', 'c2000000-0000-0000-0000-000000000001', TRUE, 5),
  ('대출상환',   'expense', '고정비용', 'c2000000-0000-0000-0000-000000000001', TRUE, 6);

-- ── 유동비용 하위 ────────────────────────────────────────────
INSERT INTO categories(name, type, plan_group, parent_id, is_system, display_order) VALUES
  ('식비',      'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 1),
  ('외식비',    'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 2),
  ('교통비',    'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 3),
  ('의류/미용', 'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 4),
  ('의료/건강', 'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 5),
  ('여가/취미', 'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 6),
  ('용돈',      'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 7),
  ('경조사',    'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 8),
  ('쇼핑',      'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 9),
  ('기타지출',  'expense', '유동비용', 'c2000000-0000-0000-0000-000000000002', TRUE, 10);
