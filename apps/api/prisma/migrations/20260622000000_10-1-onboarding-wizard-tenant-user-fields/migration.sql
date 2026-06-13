-- Migration: 10-1 Onboarding Wizard — Tenant + User fields (Story 10-1 / Epic 10)
-- Adds 4 nullable columns for the onboarding wizard feature.
-- All columns are nullable (no DEFAULT required — existing rows remain unaffected).
-- No DROP, no ALTER COLUMN type, no RENAME — purely additive.
-- No CREATE POLICY / ALTER POLICY — RLS already enabled on tenants and users tables.
-- No new PKs — no @default(uuid()) concern.

-- ---------------------------------------------------------------------------
-- 1. tenants — onboarding progress (JSONB) + logo URL (TEXT)
-- ---------------------------------------------------------------------------

ALTER TABLE "tenants"
  ADD COLUMN "onboarding_progress" JSONB,
  ADD COLUMN "logo_url" TEXT;

-- ---------------------------------------------------------------------------
-- 2. users — profile photo URL (TEXT) + role title (TEXT)
-- ---------------------------------------------------------------------------

ALTER TABLE "users"
  ADD COLUMN "profile_photo_url" TEXT,
  ADD COLUMN "role_title" TEXT;
