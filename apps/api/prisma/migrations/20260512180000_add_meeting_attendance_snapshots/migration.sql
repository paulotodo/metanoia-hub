-- Story 5-3: presence pipeline — meeting_attendance (final) + meeting_snapshots (checkpoint).
-- Follows RLS contract: tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid

-- ---------------------------------------------------------------------------
-- meeting_attendance — final aggregated presence record per (meeting, user)
-- ---------------------------------------------------------------------------

CREATE TABLE "meeting_attendance" (
  "id"                       UUID         PRIMARY KEY,
  "tenant_id"                UUID         NOT NULL,
  "meeting_id"               UUID         NOT NULL,
  "user_id"                  UUID         NOT NULL,
  "join_time"                TIMESTAMPTZ  NOT NULL,
  "leave_time"               TIMESTAMPTZ  NOT NULL,
  "total_duration_seconds"   INT          NOT NULL,
  "presence_type"            VARCHAR(16)  NOT NULL,
  "reconnections"            INT          NOT NULL DEFAULT 0,
  "created_at"               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "meeting_attendance_meeting_user_uniq"
  ON "meeting_attendance" ("meeting_id", "user_id");

CREATE INDEX "meeting_attendance_tenant_meeting_idx"
  ON "meeting_attendance" ("tenant_id", "meeting_id");

CREATE INDEX "meeting_attendance_tenant_user_idx"
  ON "meeting_attendance" ("tenant_id", "user_id");

ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_presence_type_chk"
  CHECK ("presence_type" IN ('integral', 'parcial', 'ausente'));

ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_duration_chk"
  CHECK ("total_duration_seconds" >= 0);

ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_reconnections_chk"
  CHECK ("reconnections" >= 0);

ALTER TABLE "meeting_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meeting_attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meeting_attendance"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- meeting_snapshots — periodic state checkpoints (BullMQ repeatable job)
-- ---------------------------------------------------------------------------

CREATE TABLE "meeting_snapshots" (
  "id"            UUID         PRIMARY KEY,
  "tenant_id"     UUID         NOT NULL,
  "meeting_id"    UUID         NOT NULL,
  "snapshot_data" JSONB        NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "meeting_snapshots_tenant_meeting_created_idx"
  ON "meeting_snapshots" ("tenant_id", "meeting_id", "created_at");

ALTER TABLE "meeting_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meeting_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meeting_snapshots"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
