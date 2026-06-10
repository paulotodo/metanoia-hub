-- Migration: 8-5 Sequential Access & Prerequisites
-- Adds: TrailAccessMode enum, LessonAccessMode enum,
--       access_mode on trails, lesson_access_mode on modules,
--       module_prerequisites table + RLS

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "TrailAccessMode" AS ENUM ('sequential', 'free');
CREATE TYPE "LessonAccessMode" AS ENUM ('sequential', 'free');

-- ---------------------------------------------------------------------------
-- 2. Add access_mode to trails (default free)
-- ---------------------------------------------------------------------------
ALTER TABLE "trails"
  ADD COLUMN "access_mode" "TrailAccessMode" NOT NULL DEFAULT 'free';

-- ---------------------------------------------------------------------------
-- 3. Add lesson_access_mode to modules (default free)
-- ---------------------------------------------------------------------------
ALTER TABLE "modules"
  ADD COLUMN "lesson_access_mode" "LessonAccessMode" NOT NULL DEFAULT 'free';

-- ---------------------------------------------------------------------------
-- 4. Table: module_prerequisites
-- ---------------------------------------------------------------------------
CREATE TABLE "module_prerequisites" (
  "tenant_id"             UUID NOT NULL,
  "module_id"             UUID NOT NULL,
  "prerequisite_module_id" UUID NOT NULL,

  CONSTRAINT "module_prerequisites_pkey"
    PRIMARY KEY ("module_id", "prerequisite_module_id"),
  CONSTRAINT "module_prerequisites_unique"
    UNIQUE ("tenant_id", "module_id", "prerequisite_module_id"),
  CONSTRAINT "module_prerequisites_module_id_fkey"
    FOREIGN KEY ("module_id") REFERENCES "modules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "module_prerequisites_prerequisite_module_id_fkey"
    FOREIGN KEY ("prerequisite_module_id") REFERENCES "modules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "module_prerequisites_tenant_id_idx" ON "module_prerequisites" ("tenant_id");
CREATE INDEX "module_prerequisites_module_id_idx" ON "module_prerequisites" ("module_id");

-- ---------------------------------------------------------------------------
-- 5. RLS for module_prerequisites (NULLIF invariante)
-- ---------------------------------------------------------------------------
ALTER TABLE "module_prerequisites" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_prerequisites_tenant_isolation" ON "module_prerequisites"
  USING (
    "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
