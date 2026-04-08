-- ============================================================
-- 23. 환율 데이터 (한국은행 ECOS API)
-- 매일 GitHub Actions로 수집
-- ============================================================

CREATE TABLE exchange_rates (
  id            BIGSERIAL PRIMARY KEY,
  currency_code TEXT NOT NULL,           -- USD, JPY, EUR
  currency_name TEXT NOT NULL,           -- 미국 달러, 일본 엔(100엔), 유로
  rate          NUMERIC(12, 4) NOT NULL, -- 1단위(JPY는 100단위) 당 원화
  rate_date     DATE NOT NULL,           -- 환율 기준일
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(currency_code, rate_date)
);

CREATE INDEX idx_exchange_rates_date ON exchange_rates(rate_date DESC);
CREATE INDEX idx_exchange_rates_currency_date ON exchange_rates(currency_code, rate_date DESC);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- 모든 사용자(비로그인 포함)가 조회 가능
CREATE POLICY "exchange_rates: public read"
  ON exchange_rates FOR SELECT
  USING (true);

-- service_role만 쓰기 가능 (GitHub Actions에서 사용)
-- service_role은 RLS를 우회하므로 별도 정책 불필요
