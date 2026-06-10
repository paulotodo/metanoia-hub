-- Migration: 8-4 Completion Rules
-- Adds: CompletedBy enum, completed_by to lesson_progress, tenant_content_config table + RLS

-- ---------------------------------------------------------------------------
-- 1. Enum: completed_by (who triggered lesson completion)
-- ---------------------------------------------------------------------------
CREATE TYPE "CompletedBy" AS ENUM ('participant', 'leader');

-- ---------------------------------------------------------------------------
-- 2. Add completed_by column to lesson_progress
-- ---------------------------------------------------------------------------
ALTER TABLE "lesson_progress"
  ADD COLUMN "completed_by" "CompletedBy";

-- ---------------------------------------------------------------------------
-- 3. Table: tenant_content_config (per-tenant completion rule overrides)
-- ---------------------------------------------------------------------------
CREATE TABLE "tenant_content_config" (
  "id"                            UUID        NOT NULL,
  "tenant_id"                     UUID        NOT NULL,
  "video_threshold_percent"       INTEGER     NOT NULL DEFAULT 90,
  "doc_scroll_threshold_percent"  INTEGER     NOT NULL DEFAULT 80,
  "allow_manual_video_completion" BOOLEAN     NOT NULL DEFAULT false,
  "allow_manual_doc_completion"   BOOLEAN     NOT NULL DEFAULT false,
  "created_at"                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "tenant_content_config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_content_config_tenant_id_key" UNIQUE ("tenant_id"),
  CONSTRAINT "tenant_content_config_video_threshold_check"
    CHECK ("video_threshold_percent" >= 50 AND "video_threshold_percent" <= 100),
  CONSTRAINT "tenant_content_config_doc_scroll_threshold_check"
    CHECK ("doc_scroll_threshold_percent" >= 50 AND "doc_scroll_threshold_percent" <= 100)
);

CREATE INDEX "tenant_content_config_tenant_id_idx" ON "tenant_content_config" ("tenant_id");

-- ---------------------------------------------------------------------------
-- 4. RLS for tenant_content_config (NULLIF invariante)
-- ---------------------------------------------------------------------------
ALTER TABLE "tenant_content_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_content_config_tenant_isolation" ON "tenant_content_config"
  USING (
    "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
