-- Story 5-1: extend `meetings` schema with CRUD-required fields.
-- Additive only: existing columns/policies untouched. The original status
-- check constraint (scheduled|live|ended) is replaced to admit `cancelled`.

ALTER TABLE "meetings"
  ADD COLUMN "title"            VARCHAR(200) NULL,
  ADD COLUMN "duration_minutes" INT          NULL,
  ADD COLUMN "cancelled_at"     TIMESTAMPTZ  NULL,
  ADD COLUMN "created_by"       UUID         NULL;

-- Replace status enum check to include `cancelled`.
ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_status_chk";
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_status_chk"
  CHECK ("status" IN ('scheduled', 'live', 'ended', 'cancelled'));

-- Story 5-1 lists by tenant + status + time; add covering index.
CREATE INDEX IF NOT EXISTS "meetings_tenant_status_scheduled_idx"
  ON "meetings" ("tenant_id", "status", "scheduled_for");
