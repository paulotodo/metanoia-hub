-- Meetings, meeting_participants and reflections — Cenário 02 Session 4 backend.
-- Follows the project RLS contract: tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
-- set by prisma.extension.ts via SET LOCAL before each tenant-scoped query.

-- ---------------------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------------------

CREATE TABLE "meetings" (
  "id"                UUID         PRIMARY KEY,
  "tenant_id"         UUID         NOT NULL,
  "group_id"          UUID         NOT NULL,
  "scheduled_for"     TIMESTAMPTZ  NOT NULL,
  "status"            VARCHAR(16)  NOT NULL DEFAULT 'scheduled',
  "topic"             VARCHAR(500) NULL,
  "livekit_room_id"   VARCHAR(200) NULL,
  "started_at"        TIMESTAMPTZ  NULL,
  "ended_at"          TIMESTAMPTZ  NULL,
  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "meetings_tenant_group_scheduled_idx"
  ON "meetings" ("tenant_id", "group_id", "scheduled_for");

ALTER TABLE "meetings" ADD CONSTRAINT "meetings_status_chk"
  CHECK ("status" IN ('scheduled', 'live', 'ended'));

-- ---------------------------------------------------------------------------
-- meeting_participants
-- ---------------------------------------------------------------------------

CREATE TABLE "meeting_participants" (
  "id"              UUID         PRIMARY KEY,
  "tenant_id"       UUID         NOT NULL,
  "meeting_id"      UUID         NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
  "user_id"         UUID         NULL,
  "participant_id"  UUID         NOT NULL,
  "name"            VARCHAR(200) NOT NULL,
  "response"        VARCHAR(8)   NOT NULL DEFAULT 'pending',
  "joined_at"       TIMESTAMPTZ  NULL,
  "left_at"         TIMESTAMPTZ  NULL,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "meeting_participants_meeting_participant_uniq"
  ON "meeting_participants" ("meeting_id", "participant_id");

CREATE INDEX "meeting_participants_tenant_meeting_idx"
  ON "meeting_participants" ("tenant_id", "meeting_id");

ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_response_chk"
  CHECK ("response" IN ('yes', 'no', 'pending'));

-- ---------------------------------------------------------------------------
-- reflections
-- ---------------------------------------------------------------------------

CREATE TABLE "reflections" (
  "id"           UUID         PRIMARY KEY,
  "tenant_id"    UUID         NOT NULL,
  "meeting_id"   UUID         NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
  "leader_id"    UUID         NOT NULL,
  "text"         VARCHAR(280) NOT NULL,
  "recorded_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "reflections_tenant_meeting_idx"
  ON "reflections" ("tenant_id", "meeting_id");

ALTER TABLE "reflections" ADD CONSTRAINT "reflections_text_len_chk"
  CHECK (char_length("text") BETWEEN 1 AND 280);

-- ---------------------------------------------------------------------------
-- Row Level Security — tenant isolation
-- ---------------------------------------------------------------------------

ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meetings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meetings"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "meeting_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meeting_participants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meeting_participants"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "reflections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reflections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reflections"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
