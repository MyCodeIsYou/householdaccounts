-- ============================================================
-- 27. 여행 지도 (시/군/구 방문 기록 + 색상 + 일기 + 사진)
-- travel_regions: 지역별 방문 색상(지역당 1행)
-- travel_logs:    지역별 여행 일기(지역당 여러 행)
-- 사진: Storage 버킷 'travel-photos'
-- 개인/그룹 스코핑은 다른 테이블(liabilities 등)과 동일 패턴
-- ============================================================

-- ─── 지역 색상/방문 상태 ───────────────────────────────────────────────
CREATE TABLE travel_regions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  region_code  TEXT NOT NULL,               -- 시군구 코드 (예: 11010)
  region_name  TEXT NOT NULL,               -- 시군구 이름 (예: 종로구)
  color        TEXT NOT NULL DEFAULT '#6366f1',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 스코프별 지역 유일성 (household_id NULL 은 개인 데이터)
CREATE UNIQUE INDEX uq_travel_regions_personal
  ON travel_regions(user_id, region_code) WHERE household_id IS NULL;
CREATE UNIQUE INDEX uq_travel_regions_hh
  ON travel_regions(household_id, region_code) WHERE household_id IS NOT NULL;

ALTER TABLE travel_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_regions: select"
  ON travel_regions FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "travel_regions: insert"
  ON travel_regions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "travel_regions: update"
  ON travel_regions FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "travel_regions: delete"
  ON travel_regions FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON travel_regions TO authenticated;

CREATE TRIGGER trg_travel_regions_updated_at
  BEFORE UPDATE ON travel_regions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 여행 일기 (지역당 여러 개) ────────────────────────────────────────
CREATE TABLE travel_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  region_code  TEXT NOT NULL,
  region_name  TEXT NOT NULL,
  title        TEXT,
  visited_date DATE,
  memo         TEXT,
  photo_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_travel_logs_personal
  ON travel_logs(user_id, region_code) WHERE household_id IS NULL;
CREATE INDEX idx_travel_logs_hh
  ON travel_logs(household_id, region_code) WHERE household_id IS NOT NULL;

ALTER TABLE travel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_logs: select"
  ON travel_logs FOR SELECT
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "travel_logs: insert"
  ON travel_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "travel_logs: update"
  ON travel_logs FOR UPDATE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());
CREATE POLICY "travel_logs: delete"
  ON travel_logs FOR DELETE
  USING (auth.uid() = user_id OR household_id IN (SELECT my_household_ids()) OR is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON travel_logs TO authenticated;

CREATE TRIGGER trg_travel_logs_updated_at
  BEFORE UPDATE ON travel_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 사진 저장용 Storage 버킷 ──────────────────────────────────────────
-- public read: 그룹원과 공유 + 웹/앱 어디서나 표시. 경로에 uuid 포함(추측 불가).
-- 쓰기/삭제: 본인(auth.uid) 폴더에만 허용.  경로 규칙: <user_id>/<region_code>/<uuid>.<ext>
INSERT INTO storage.buckets (id, name, public)
  VALUES ('travel-photos', 'travel-photos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "travel-photos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'travel-photos');

CREATE POLICY "travel-photos: auth upload own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'travel-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "travel-photos: auth delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'travel-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── 메뉴 등록 ─────────────────────────────────────────────────────────
INSERT INTO menu_configs (menu_key, label, path, icon_name, min_role, is_enabled, display_order) VALUES
  ('travel-map', '여행 지도', '/travel-map', 'Map', 'user', true, 11)
ON CONFLICT (menu_key) DO NOTHING;
