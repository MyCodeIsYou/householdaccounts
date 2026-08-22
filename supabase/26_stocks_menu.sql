-- 26. 주식 시세 메뉴 등록 (토스증권 Open API 페이지)
-- menu_configs 가 DB로 관리되므로, 운영 환경에서 사이드바에 노출되려면 행 추가 필요.

INSERT INTO menu_configs (menu_key, label, path, icon_name, min_role, is_enabled, display_order) VALUES
  ('stocks', '주식 시세', '/stocks', 'LineChart', 'user', true, 12)
ON CONFLICT (menu_key) DO NOTHING;
