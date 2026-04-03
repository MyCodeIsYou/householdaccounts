-- ============================================================
-- 10. households, household_members, household_invites
-- ============================================================

CREATE TABLE households (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE household_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

CREATE TABLE household_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used_count   INT NOT NULL DEFAULT 0,
  max_uses     INT NOT NULL DEFAULT 10,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE households       ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

-- ── households RLS ───────────────────────────────────────────
CREATE POLICY "households: member can read"
  ON households FOR SELECT
  USING (id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "households: owner can insert"
  ON households FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "households: owner can update"
  ON households FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "households: owner can delete"
  ON households FOR DELETE
  USING (auth.uid() = owner_id);

-- ── household_members RLS ────────────────────────────────────
CREATE POLICY "hm: same group can read"
  ON household_members FOR SELECT
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "hm: self insert"
  ON household_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hm: owner or self delete"
  ON household_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
  );

-- ── household_invites RLS ────────────────────────────────────
CREATE POLICY "hi: member can read"
  ON household_invites FOR SELECT
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "hi: owner can insert"
  ON household_invites FOR INSERT
  WITH CHECK (household_id IN (
    SELECT id FROM households WHERE owner_id = auth.uid()
  ));

CREATE POLICY "hi: owner can update"
  ON household_invites FOR UPDATE
  USING (household_id IN (
    SELECT id FROM households WHERE owner_id = auth.uid()
  ));
