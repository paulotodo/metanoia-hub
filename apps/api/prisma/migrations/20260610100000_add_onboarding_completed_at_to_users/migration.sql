-- Migration: add onboarding_completed_at to users
-- Story 7-1: first-access personalised welcome screen.
-- NULL = onboarding pending; non-null = onboarding complete (timestamp for analytics).
-- No default — new and existing users stay null until they dismiss the welcome screen.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMPTZ NULL;
