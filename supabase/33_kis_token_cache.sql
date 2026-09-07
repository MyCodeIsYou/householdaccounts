-- ============================================================
-- 33. kis_token_cache (KIS API 토큰 캐시)
-- Edge Function 콜드스타트마다 토큰 재발급하는 문제 해결
-- ============================================================
CREATE TABLE kis_token_cache (
  id            TEXT PRIMARY KEY DEFAULT 'default',
  access_token  TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'paper',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 비활성화 — Edge Function(service_role)만 접근
ALTER TABLE kis_token_cache ENABLE ROW LEVEL SECURITY;

-- service_role만 접근 가능
CREATE POLICY "kis_token_cache: service_role only"
  ON kis_token_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
