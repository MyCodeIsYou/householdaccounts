-- ============================================================
-- 36. 메뉴 부모 (하위 메뉴)
-- parent_menu_key 가 있으면 그 메뉴의 하위 메뉴다. 한 단계만 허용.
-- ============================================================

ALTER TABLE menu_configs
  ADD COLUMN IF NOT EXISTS parent_menu_key TEXT;

ALTER TABLE menu_configs DROP CONSTRAINT IF EXISTS menu_configs_parent_fk;
ALTER TABLE menu_configs
  ADD CONSTRAINT menu_configs_parent_fk
  FOREIGN KEY (parent_menu_key) REFERENCES menu_configs(menu_key) ON DELETE SET NULL;

ALTER TABLE menu_configs DROP CONSTRAINT IF EXISTS menu_configs_no_self_parent;
ALTER TABLE menu_configs
  ADD CONSTRAINT menu_configs_no_self_parent
  CHECK (parent_menu_key IS NULL OR parent_menu_key <> menu_key);

CREATE INDEX IF NOT EXISTS idx_menu_configs_parent ON menu_configs(parent_menu_key);

CREATE OR REPLACE FUNCTION enforce_menu_one_level()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_menu_key IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM menu_configs
    WHERE menu_key = NEW.parent_menu_key
      AND parent_menu_key IS NOT NULL
  ) THEN
    RAISE EXCEPTION '하위 메뉴 아래에는 다시 넣을 수 없습니다';
  END IF;

  IF EXISTS (
    SELECT 1 FROM menu_configs
    WHERE parent_menu_key = NEW.menu_key
  ) THEN
    RAISE EXCEPTION '하위 메뉴가 있는 항목은 다른 메뉴 아래로 넣을 수 없습니다';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_configs_one_level ON menu_configs;
CREATE TRIGGER trg_menu_configs_one_level
  BEFORE INSERT OR UPDATE OF parent_menu_key ON menu_configs
  FOR EACH ROW EXECUTE FUNCTION enforce_menu_one_level();
