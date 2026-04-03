-- ============================================================
-- 07. annual_plan (연간 계획 금액 — 계획만 저장, 실적은 transactions에서 집계)
-- ============================================================
CREATE TABLE annual_plan (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_year   SMALLINT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  jan  NUMERIC(15,2) NOT NULL DEFAULT 0,
  feb  NUMERIC(15,2) NOT NULL DEFAULT 0,
  mar  NUMERIC(15,2) NOT NULL DEFAULT 0,
  apr  NUMERIC(15,2) NOT NULL DEFAULT 0,
  may  NUMERIC(15,2) NOT NULL DEFAULT 0,
  jun  NUMERIC(15,2) NOT NULL DEFAULT 0,
  jul  NUMERIC(15,2) NOT NULL DEFAULT 0,
  aug  NUMERIC(15,2) NOT NULL DEFAULT 0,
  sep  NUMERIC(15,2) NOT NULL DEFAULT 0,
  oct  NUMERIC(15,2) NOT NULL DEFAULT 0,
  nov  NUMERIC(15,2) NOT NULL DEFAULT 0,
  dec  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_year, category_id)
);

ALTER TABLE annual_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_plan: own data only"
  ON annual_plan FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
