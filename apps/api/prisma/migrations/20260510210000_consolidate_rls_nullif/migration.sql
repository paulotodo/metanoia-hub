-- Story 7-5 (Task 4) — consolidate RLS policies to defensive NULLIF form
--
-- Prior migrations created `tenant_isolation` policies with two different
-- forms:
--   A) `tenant_id = current_setting('app.current_tenant_id')::uuid`
--      Fails with `invalid input syntax for type uuid: ""` when SET LOCAL
--      is missing (default setting is an empty string after server reset).
--   B) `tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`
--      Tolerates a missing setting — cast yields NULL, comparison is NULL,
--      row is excluded (closed-by-default).
--
-- Form B is correct for multi-tenant: pre-tenant queries (health checks,
-- migrations, public endpoints) should be silently empty rather than
-- raise. This migration drops every variant of (A) and recreates each
-- with form (B), and consolidates the duplicate `<table>_tenant_isolation`
-- policies that overlapped the canonical `tenant_isolation` with a
-- weaker predicate (no NULLIF, sometimes adding `tenant_id IS NULL OR`).
--
-- After this migration, every USING clause across the schema reads
-- `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.
-- Tables with nullable `tenant_id` (users, consents) additionally accept
-- `tenant_id IS NULL` so the register flow can read its own pre-tenant row.

-- =========================================================================
-- NOT NULL tenant_id — replace pure-flat policy with NULLIF form
-- =========================================================================

DROP POLICY IF EXISTS tenant_isolation ON pastoral_actions;
CREATE POLICY tenant_isolation ON pastoral_actions
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON pastoral_alerts;
CREATE POLICY tenant_isolation ON pastoral_alerts
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON pastoral_notes;
CREATE POLICY tenant_isolation ON pastoral_notes
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- meeting_events had a differently-named policy and a custom INSERT policy
DROP POLICY IF EXISTS meeting_events_tenant_isolation ON meeting_events;
DROP POLICY IF EXISTS tenant_isolation ON meeting_events;
CREATE POLICY tenant_isolation ON meeting_events
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS meeting_events_tenant_insert ON meeting_events;
CREATE POLICY meeting_events_tenant_insert ON meeting_events
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- =========================================================================
-- Drop duplicate `<table>_tenant_isolation` policies that were superseded
-- by the canonical `tenant_isolation` (which we keep / rewrite below).
-- =========================================================================

DROP POLICY IF EXISTS consents_tenant_isolation ON consents;
DROP POLICY IF EXISTS users_tenant_isolation ON users;
DROP POLICY IF EXISTS user_tenants_tenant_isolation ON user_tenants;

-- =========================================================================
-- Nullable tenant_id — rewrite tenant_isolation to include `IS NULL` clause
-- (the duplicate `*_tenant_isolation` policy used to provide this; merge it
-- into the canonical name).
-- =========================================================================

DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING ((tenant_id IS NULL) OR (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));

DROP POLICY IF EXISTS tenant_isolation ON consents;
CREATE POLICY tenant_isolation ON consents
  USING ((tenant_id IS NULL) OR (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));

-- invites.tenant_id is also nullable but its existing tenant_isolation
-- policy already has both `IS NULL OR ...` and NULLIF — no rewrite needed.

-- =========================================================================
-- Post-condition: every remaining USING clause references NULLIF.
-- Verified manually after deploy with:
--   SELECT polname, pg_get_expr(polqual, polrelid)
--   FROM pg_policy
--   WHERE pg_get_expr(polqual, polrelid) LIKE '%current_setting%'
--     AND pg_get_expr(polqual, polrelid) NOT LIKE '%NULLIF%';
-- Expected: zero rows.
-- =========================================================================
