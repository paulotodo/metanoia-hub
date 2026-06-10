-- Story 8-1: Add trails, modules, lessons tables for Content bounded context
-- Follows RLS contract: tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
-- Additive migration — no existing tables modified.

-- Enums for content lifecycle
CREATE TYPE "TrailStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "LessonContentType" AS ENUM ('video', 'rich_text', 'pdf_doc', 'external_link');

-- Trail — top-level discipleship trail owned by a tenant
CREATE TABLE "trails" (
  "id"          UUID          NOT NULL,
  "tenant_id"   UUID          NOT NULL,
  "name"        VARCHAR(255)  NOT NULL,
  "description" VARCHAR(1000),
  "status"      "TrailStatus" NOT NULL DEFAULT 'draft',
  "created_by"  UUID          NOT NULL,
  "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "deleted_at"  TIMESTAMPTZ,

  CONSTRAINT "trails_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trails_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trails_tenant_id_idx"         ON "trails" ("tenant_id");
CREATE INDEX "trails_tenant_id_status_idx"  ON "trails" ("tenant_id", "status");

-- RLS: Enable and enforce tenant isolation for trails
ALTER TABLE "trails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trails" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_trails_tenant_isolation ON "trails"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Module — ordered module within a trail
CREATE TABLE "modules" (
  "id"         UUID         NOT NULL,
  "tenant_id"  UUID         NOT NULL,
  "trail_id"   UUID         NOT NULL,
  "name"       VARCHAR(255) NOT NULL,
  "order"      INTEGER      NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ,

  CONSTRAINT "modules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "modules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "modules_trail_id_fkey"
    FOREIGN KEY ("trail_id") REFERENCES "trails"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "modules_tenant_id_idx" ON "modules" ("tenant_id");
CREATE INDEX "modules_trail_id_idx"  ON "modules" ("trail_id");

-- RLS: Enable and enforce tenant isolation for modules
ALTER TABLE "modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modules" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_modules_tenant_isolation ON "modules"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Lesson — ordered lesson within a module
CREATE TABLE "lessons" (
  "id"                          UUID                NOT NULL,
  "tenant_id"                   UUID                NOT NULL,
  "module_id"                   UUID                NOT NULL,
  "name"                        VARCHAR(255)        NOT NULL,
  "content_type"                "LessonContentType" NOT NULL,
  "content_url"                 VARCHAR(2048),
  "order"                       INTEGER             NOT NULL,
  "estimated_duration_minutes"  INTEGER,
  "created_at"                  TIMESTAMPTZ         NOT NULL DEFAULT now(),
  "updated_at"                  TIMESTAMPTZ         NOT NULL DEFAULT now(),
  "deleted_at"                  TIMESTAMPTZ,

  CONSTRAINT "lessons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lessons_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lessons_module_id_fkey"
    FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "lessons_tenant_id_idx" ON "lessons" ("tenant_id");
CREATE INDEX "lessons_module_id_idx" ON "lessons" ("module_id");

-- RLS: Enable and enforce tenant isolation for lessons
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lessons" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_lessons_tenant_isolation ON "lessons"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
