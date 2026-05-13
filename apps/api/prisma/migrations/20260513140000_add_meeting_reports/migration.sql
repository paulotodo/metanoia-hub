-- Story 5-6: meeting_reports — aggregated post-meeting report per meeting.
-- summary is a JSONB blob conforming to MeetingReportSummarySchema in
-- packages/types (validated by service before write).

CREATE TABLE "meeting_reports" (
  "id"           UUID         PRIMARY KEY,
  "tenant_id"    UUID         NOT NULL,
  "meeting_id"   UUID         NOT NULL,
  "summary"      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  "generated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "meeting_reports_meeting_uniq"
  ON "meeting_reports" ("meeting_id");

CREATE INDEX "meeting_reports_tenant_meeting_idx"
  ON "meeting_reports" ("tenant_id", "meeting_id");

ALTER TABLE "meeting_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meeting_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meeting_reports"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
