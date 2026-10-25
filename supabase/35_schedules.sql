-- ============================================================
-- 35. 일정 관리
-- 반복 규칙 한 건을 저장하고, 화면에서 선택한 해로 펼친다.
-- 개인/그룹 스코핑은 travel_logs 와 동일 패턴
-- ============================================================

CREATE TABLE schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id      UUID REFERENCES households(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  memo              TEXT,
  start_date        DATE NOT NULL,
  end_date          DATE,
  start_time        TIME,
  end_time          TIME,
  recurrence        TEXT NOT NULL DEFAULT 'none'
                    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  recurrence_until  DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedules_end_after_start
    CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT schedules_time_order
    CHECK (
      start_time IS NULL OR end_time IS NULL OR end_time >= start_time
      OR (end_date IS NOT NULL AND end_date > start_date)
    ),
  CONSTRAINT schedules_until_after_start
    CHECK (recurrence_until IS NULL OR recurrence_until >= start_date),
  CONSTRAINT schedules_none_has_no_until
    CHECK (recurrence <> 'none' OR recurrence_until IS NULL)
);

CREATE INDEX idx_schedules_personal
  ON schedules(user_id, start_date) WHERE household_id IS NULL;
CREATE INDEX idx_schedules_hh
  ON schedules(household_id, start_date) WHERE household_id IS NOT NULL;

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules: select"
  ON schedules FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "schedules: insert"
  ON schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "schedules: update"
  ON schedules FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "schedules: delete"
  ON schedules FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON schedules TO authenticated;

CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 메뉴 등록 ─────────────────────────────────────────────────────────
INSERT INTO menu_configs (menu_key, label, path, icon_name, min_role, is_enabled, display_order) VALUES
  ('schedules', '일정 관리', '/schedules', 'CalendarClock', 'user', true, 14)
ON CONFLICT (menu_key) DO NOTHING;

-- 이미 schedules 를 만든 뒤에 종료 날짜만 더할 때
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_end_after_start;
ALTER TABLE schedules
  ADD CONSTRAINT schedules_end_after_start
  CHECK (end_date IS NULL OR end_date >= start_date);

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_time_order;
ALTER TABLE schedules
  ADD CONSTRAINT schedules_time_order
  CHECK (
    start_time IS NULL OR end_time IS NULL OR end_time >= start_time
    OR (end_date IS NOT NULL AND end_date > start_date)
  );
