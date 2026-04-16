-- outreach_intents — Cenário 03 Session 4 backend.
-- Private pastoral note from Admin Tenant about a leader for a given ISO week.
-- Follows the project RLS contract: tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
-- set by prisma.extension.ts via SET LOCAL before each tenant-scoped query.

-- ---------------------------------------------------------------------------
-- outreach_intents
-- ---------------------------------------------------------------------------

CREATE TABLE "outreach_intents" (
  "id"                  UUID         PRIMARY KEY,
  "tenant_id"           UUID         NOT NULL,
  "created_by_user_id"  UUID         NOT NULL,
  "target_leader_id"    UUID         NOT NULL,
  "week_of"             TIMESTAMPTZ  NOT NULL,
  "note"                VARCHAR(280) NOT NULL,
  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "outreach_intents_tenant_user_leader_week_uniq"
  ON "outreach_intents" ("tenant_id", "created_by_user_id", "target_leader_id", "week_of");

CREATE INDEX "outreach_intents_tenant_idx"
  ON "outreach_intents" ("tenant_id");

CREATE INDEX "outreach_intents_target_leader_idx"
  ON "outreach_intents" ("target_leader_id");

ALTER TABLE "outreach_intents" ADD CONSTRAINT "outreach_intents_note_len_chk"
  CHECK (char_length("note") BETWEEN 1 AND 280);

-- ---------------------------------------------------------------------------
-- Row Level Security — tenant isolation
-- ---------------------------------------------------------------------------

ALTER TABLE "outreach_intents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach_intents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "outreach_intents"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
