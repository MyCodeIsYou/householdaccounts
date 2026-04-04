-- ============================================================
-- 16. 고객센터 (1:1 문의 + 답변)
-- ============================================================

-- ── 문의글 ───────────────────────────────────────────────────
CREATE TABLE support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'answered', 'closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_user ON support_tickets(user_id, created_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- 본인 글 + super_admin 전체 조회
CREATE POLICY "tickets: select"
  ON support_tickets FOR SELECT
  USING (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "tickets: insert"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tickets: update"
  ON support_tickets FOR UPDATE
  USING (auth.uid() = user_id OR is_super_admin());
CREATE POLICY "tickets: delete"
  ON support_tickets FOR DELETE
  USING (auth.uid() = user_id OR is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON support_tickets TO authenticated;

-- ── 답변 ─────────────────────────────────────────────────────
CREATE TABLE support_replies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_replies_ticket ON support_replies(ticket_id, created_at ASC);

ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;

-- 해당 문의글 작성자 + super_admin만 조회/작성
CREATE POLICY "replies: select"
  ON support_replies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR is_super_admin()))
  );
CREATE POLICY "replies: insert"
  ON support_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "replies: delete"
  ON support_replies FOR DELETE
  USING (auth.uid() = user_id OR is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON support_replies TO authenticated;

-- updated_at 트리거
CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 메뉴 추가
INSERT INTO menu_configs (menu_key, label, path, icon_name, min_role, is_enabled, display_order) VALUES
  ('support', '고객센터', '/support', 'MessageCircle', 'user', true, 11)
ON CONFLICT (menu_key) DO NOTHING;
