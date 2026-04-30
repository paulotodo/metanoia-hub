-- Story 4-3 — extend invites table to support admin-tenant-side invites.
-- Existing rows keep kind='pre_tenant_signup' (the original flow that creates
-- a brand new tenant). New kinds: 'tenant_member', 'tenant_leader', etc.

ALTER TABLE "invites"
  ADD COLUMN "kind" VARCHAR(32) NOT NULL DEFAULT 'pre_tenant_signup',
  ADD COLUMN "invitee_role" VARCHAR(32),
  ADD COLUMN "group_id" UUID,
  ADD COLUMN "revoked_at" TIMESTAMPTZ;

CREATE INDEX "invites_kind_idx" ON "invites"("kind");
