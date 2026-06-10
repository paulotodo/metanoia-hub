-- Migration: add metadata (JSONB) and updated_at to tenants table
-- Story 3-2 residual AC#5: PATCH /admin/super/tenants/:id now exposes
-- updated_at (ISO 8601) and accepts metadata (JSONB) as an editable field.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "metadata"    JSONB        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW();

-- Back-fill updated_at for existing rows (use created_at as a safe default)
UPDATE "tenants" SET "updated_at" = "created_at" WHERE "updated_at" = NOW();
