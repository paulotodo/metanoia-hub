-- Invites table + tenant-scoped Row Level Security for the remaining core tables.
-- Pattern: tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
-- Set by prisma.extension.ts via SET LOCAL before each tenant-scoped query.
-- The NULLIF + second arg `true` allows pre-tenant contexts (e.g. public invite lookup)
-- to execute without raising "unrecognized configuration parameter".

-- ---------------------------------------------------------------------------
-- invites table
-- ---------------------------------------------------------------------------

CREATE TABLE "invites" (
  "id"                 UUID           PRIMARY KEY,
  "token"              TEXT           NOT NULL UNIQUE,
  "tenant_id"          UUID           NULL REFERENCES "tenants"("id"),
  "leader_name"        VARCHAR(200)   NOT NULL,
  "leader_email"       VARCHAR(320)   NOT NULL,
  "church_name"        VARCHAR(200)   NULL,
  "expires_at"         TIMESTAMPTZ    NOT NULL,
  "used_at"            TIMESTAMPTZ    NULL,
  "terms_accepted_at"  TIMESTAMPTZ    NULL,
  "created_at"         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX "invites_tenant_id_idx" ON "invites" ("tenant_id");

-- ---------------------------------------------------------------------------
-- groups — add scheduling fields to match CreateGroupRequestSchema contract.
-- DEFAULTs on day_of_week/time exist only to backfill pre-existing rows; they
-- are dropped immediately so future inserts without the columns fail loudly.
-- ---------------------------------------------------------------------------

ALTER TABLE "groups" ADD COLUMN "day_of_week" VARCHAR(8)  NOT NULL DEFAULT 'mon';
ALTER TABLE "groups" ADD COLUMN "time"        VARCHAR(5)  NOT NULL DEFAULT '19:00';
ALTER TABLE "groups" ADD COLUMN "recurrence"  VARCHAR(16) NOT NULL DEFAULT 'weekly';
ALTER TABLE "groups" ADD COLUMN "notes"       VARCHAR(500) NULL;
ALTER TABLE "groups" ADD COLUMN "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "groups" ALTER COLUMN "day_of_week" DROP DEFAULT;
ALTER TABLE "groups" ALTER COLUMN "time"        DROP DEFAULT;

ALTER TABLE "groups" ADD CONSTRAINT "groups_time_format_chk"
  CHECK ("time" ~ '^[0-2][0-9]:[0-5][0-9]$');

-- ---------------------------------------------------------------------------
-- Row Level Security — tenant isolation
-- ---------------------------------------------------------------------------

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- user_tenants
ALTER TABLE "user_tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_tenants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_tenants"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- consents
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "consents"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- groups (policy may already exist from 20260413131927_add_pastoral_rls — drop first for idempotency)
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "groups";
CREATE POLICY tenant_isolation ON "groups"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- group_members (policy may already exist — drop first)
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "group_members";
CREATE POLICY tenant_isolation ON "group_members"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- invites (permissive when tenant_id IS NULL — pre-tenant invite lookup)
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invites" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invites"
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
