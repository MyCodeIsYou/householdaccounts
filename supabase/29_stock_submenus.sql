-- ============================================================
-- 29. 주식 하위 메뉴 등록 (자동매매, 주식 분석, 자료 수집)
-- ============================================================

INSERT INTO menu_configs (menu_key, label, path, icon_name, min_role, is_enabled, display_order) VALUES
  ('stock-auto-trade',     '자동매매',  '/stock-auto-trade',     'Bot',      'admin', true, 12.1),
  ('stock-analysis',       '주식 분석', '/stock-analysis',       'Activity', 'admin', true, 12.2),
  ('stock-data-collector', '자료 수집', '/stock-data-collector', 'Database', 'admin', true, 12.3)
ON CONFLICT (menu_key) DO NOTHING;
