-- Story 5-4: meeting_telemetry — per-user engagement signals.
-- focus_score is nullable: NULL when the per-tenant focus_indicator_enabled
-- toggle is OFF (Story 5-5 default); a Decimal(3,2) in [0, 1] otherwise.
-- Follows RLS contract: tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid

CREATE TABLE "meeting_telemetry" (
  "id"                       UUID         PRIMARY KEY,
  "tenant_id"                UUID         NOT NULL,
  "meeting_id"               UUID         NOT NULL,
  "user_id"                  UUID         NOT NULL,
  "camera_on_seconds"        INT          NOT NULL DEFAULT 0,
  "room_duration_seconds"    INT          NOT NULL DEFAULT 0,
  "focus_score"              DECIMAL(3,2) NULL,
  "created_at"               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "meeting_telemetry_meeting_user_uniq"
  ON "meeting_telemetry" ("meeting_id", "user_id");

CREATE INDEX "meeting_telemetry_tenant_meeting_idx"
  ON "meeting_telemetry" ("tenant_id", "meeting_id");

ALTER TABLE "meeting_telemetry" ADD CONSTRAINT "meeting_telemetry_camera_chk"
  CHECK ("camera_on_seconds" >= 0);

ALTER TABLE "meeting_telemetry" ADD CONSTRAINT "meeting_telemetry_room_chk"
  CHECK ("room_duration_seconds" >= 0);

ALTER TABLE "meeting_telemetry" ADD CONSTRAINT "meeting_telemetry_focus_chk"
  CHECK ("focus_score" IS NULL OR ("focus_score" >= 0 AND "focus_score" <= 1));

ALTER TABLE "meeting_telemetry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meeting_telemetry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meeting_telemetry"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
