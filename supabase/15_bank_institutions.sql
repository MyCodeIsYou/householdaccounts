-- ============================================================
-- 15. 은행/기관 + 계좌 종류 마스터 테이블
-- super_admin이 관리하는 글로벌 설정
-- ============================================================

-- ── 은행/기관 ────────────────────────────────────────────────
CREATE TABLE bank_institutions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL DEFAULT '은행'
                CHECK (category IN ('은행', '증권', '연금', '기타')),
  display_order INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bank_institutions ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자가 읽기 가능, 쓰기는 super_admin만
CREATE POLICY "bank_inst: read" ON bank_institutions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bank_inst: admin write" ON bank_institutions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON bank_institutions TO authenticated;

-- 기본 시드 데이터
INSERT INTO bank_institutions (name, category, display_order) VALUES
  ('국민은행',       '은행', 1),
  ('신한은행',       '은행', 2),
  ('하나은행',       '은행', 3),
  ('우리은행',       '은행', 4),
  ('농협은행',       '은행', 5),
  ('IBK기업은행',    '은행', 6),
  ('케이뱅크',       '은행', 7),
  ('카카오뱅크',     '은행', 8),
  ('토스뱅크',       '은행', 9),
  ('삼성증권',       '증권', 10),
  ('미래에셋증권',   '증권', 11),
  ('NH투자증권',     '증권', 12),
  ('키움증권',       '증권', 13),
  ('KB증권',         '증권', 14),
  ('한국투자증권',   '증권', 15),
  ('대신증권',       '증권', 16),
  ('신한투자증권',   '증권', 17),
  ('국민연금',       '연금', 18),
  ('퇴직연금(IRP)',  '연금', 19),
  ('ISA',            '기타', 20)
ON CONFLICT (name) DO NOTHING;

-- ── 계좌 종류 ────────────────────────────────────────────────
CREATE TABLE account_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_types: read" ON account_types
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "account_types: admin write" ON account_types
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON account_types TO authenticated;

-- 기본 시드 데이터
INSERT INTO account_types (name, display_order) VALUES
  ('입출금', 1),
  ('예금',   2),
  ('적금',   3),
  ('증권',   4),
  ('연금',   5),
  ('CMA',    6),
  ('외화',   7),
  ('기타',   8)
ON CONFLICT (name) DO NOTHING;
