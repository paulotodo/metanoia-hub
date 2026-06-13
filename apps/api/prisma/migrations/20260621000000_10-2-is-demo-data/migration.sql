-- Migration: 10-2 Demo Data Flag (Story 10-2 / Epic 10 — Onboarding Avançado)
-- Adds is_demo_data BOOLEAN column to 12 tables.
-- Adds composite index (tenant_id, is_demo_data) per table for efficient cleanup queries.
-- All columns are non-nullable with DEFAULT false (zero downtime — existing rows get false).
-- No destructive changes (DROP, ALTER COLUMN type, RENAME).

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------

ALTER TABLE "users"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "users_tenant_id_is_demo_data_idx"
  ON "users" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 2. groups
-- ---------------------------------------------------------------------------

ALTER TABLE "groups"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "groups_tenant_id_is_demo_data_idx"
  ON "groups" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 3. group_members
-- ---------------------------------------------------------------------------

ALTER TABLE "group_members"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "group_members_tenant_id_is_demo_data_idx"
  ON "group_members" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 4. meetings
-- ---------------------------------------------------------------------------

ALTER TABLE "meetings"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "meetings_tenant_id_is_demo_data_idx"
  ON "meetings" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 5. meeting_attendance
-- ---------------------------------------------------------------------------

ALTER TABLE "meeting_attendance"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "meeting_attendance_tenant_id_is_demo_data_idx"
  ON "meeting_attendance" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 6. meeting_telemetry
-- ---------------------------------------------------------------------------

ALTER TABLE "meeting_telemetry"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "meeting_telemetry_tenant_id_is_demo_data_idx"
  ON "meeting_telemetry" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 7. pastoral_actions
-- ---------------------------------------------------------------------------

ALTER TABLE "pastoral_actions"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "pastoral_actions_tenant_id_is_demo_data_idx"
  ON "pastoral_actions" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 8. trails
-- ---------------------------------------------------------------------------

ALTER TABLE "trails"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "trails_tenant_id_is_demo_data_idx"
  ON "trails" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 9. modules
-- ---------------------------------------------------------------------------

ALTER TABLE "modules"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "modules_tenant_id_is_demo_data_idx"
  ON "modules" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 10. lessons
-- ---------------------------------------------------------------------------

ALTER TABLE "lessons"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "lessons_tenant_id_is_demo_data_idx"
  ON "lessons" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 11. module_progress
-- ---------------------------------------------------------------------------

ALTER TABLE "module_progress"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "module_progress_tenant_id_is_demo_data_idx"
  ON "module_progress" ("tenant_id", "is_demo_data");

-- ---------------------------------------------------------------------------
-- 12. trail_progress
-- ---------------------------------------------------------------------------

ALTER TABLE "trail_progress"
  ADD COLUMN "is_demo_data" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "trail_progress_tenant_id_is_demo_data_idx"
  ON "trail_progress" ("tenant_id", "is_demo_data");
