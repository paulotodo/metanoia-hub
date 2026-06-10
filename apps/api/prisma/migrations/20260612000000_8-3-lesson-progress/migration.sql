-- Migration: 8-3 Lesson/Module/Trail Progress Tracking
-- Story 8-3: Progresso Individual & Percentual de Conclusão

-- Enum: LessonStatus
CREATE TYPE "LessonStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- Table: lesson_progress
CREATE TABLE "lesson_progress" (
  "id"               UUID        NOT NULL,
  "tenant_id"        UUID        NOT NULL,
  "user_id"          UUID        NOT NULL,
  "lesson_id"        UUID        NOT NULL,
  "status"           "LessonStatus" NOT NULL DEFAULT 'not_started',
  "progress_percent" INTEGER     NOT NULL DEFAULT 0,
  "started_at"       TIMESTAMPTZ,
  "completed_at"     TIMESTAMPTZ,
  "last_accessed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_progress_lesson_fk" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_progress_percent_check" CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
);

CREATE UNIQUE INDEX "lesson_progress_tenant_user_lesson_key" ON "lesson_progress"("tenant_id", "user_id", "lesson_id");
CREATE INDEX "lesson_progress_tenant_user_idx" ON "lesson_progress"("tenant_id", "user_id");
CREATE INDEX "lesson_progress_lesson_idx" ON "lesson_progress"("lesson_id");

-- Table: module_progress
CREATE TABLE "module_progress" (
  "id"                UUID        NOT NULL,
  "tenant_id"         UUID        NOT NULL,
  "user_id"           UUID        NOT NULL,
  "module_id"         UUID        NOT NULL,
  "progress_percent"  INTEGER     NOT NULL DEFAULT 0,
  "completed_lessons" INTEGER     NOT NULL DEFAULT 0,
  "total_lessons"     INTEGER     NOT NULL DEFAULT 0,
  "completed_at"      TIMESTAMPTZ,
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "module_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "module_progress_percent_check" CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
);

CREATE UNIQUE INDEX "module_progress_tenant_user_module_key" ON "module_progress"("tenant_id", "user_id", "module_id");
CREATE INDEX "module_progress_tenant_user_idx" ON "module_progress"("tenant_id", "user_id");

-- Table: trail_progress
CREATE TABLE "trail_progress" (
  "id"                UUID        NOT NULL,
  "tenant_id"         UUID        NOT NULL,
  "user_id"           UUID        NOT NULL,
  "trail_id"          UUID        NOT NULL,
  "progress_percent"  INTEGER     NOT NULL DEFAULT 0,
  "completed_modules" INTEGER     NOT NULL DEFAULT 0,
  "total_modules"     INTEGER     NOT NULL DEFAULT 0,
  "completed_at"      TIMESTAMPTZ,
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "trail_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trail_progress_percent_check" CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
);

CREATE UNIQUE INDEX "trail_progress_tenant_user_trail_key" ON "trail_progress"("tenant_id", "user_id", "trail_id");
CREATE INDEX "trail_progress_tenant_user_idx" ON "trail_progress"("tenant_id", "user_id");

-- RLS: lesson_progress
ALTER TABLE "lesson_progress" ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: only see records from your tenant
CREATE POLICY "lesson_progress_tenant_isolation" ON "lesson_progress"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Cross-user isolation: participants only see their own progress
CREATE POLICY "lesson_progress_user_isolation" ON "lesson_progress"
  USING (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_role', true) IN ('admin_tenant', 'lider', 'super_admin')
  );

-- RLS: module_progress
ALTER TABLE "module_progress" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_progress_tenant_isolation" ON "module_progress"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "module_progress_user_isolation" ON "module_progress"
  USING (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_role', true) IN ('admin_tenant', 'lider', 'super_admin')
  );

-- RLS: trail_progress
ALTER TABLE "trail_progress" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trail_progress_tenant_isolation" ON "trail_progress"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "trail_progress_user_isolation" ON "trail_progress"
  USING (
    user_id::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_role', true) IN ('admin_tenant', 'lider', 'super_admin')
  );
