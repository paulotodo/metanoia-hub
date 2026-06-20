-- Story 13-5 / FR42: Content Templates (reusable trail structure snapshots)
-- SECURITY-CRITICAL (owasp gate, dec-015): Split READ from WRITE policies.
-- READ allows tenant_id IS NULL (platform) OR own tenant.
-- WRITE restricts to own tenant_id ONLY — NEVER NULL.
-- Platform rows written exclusively by seed (elevated role), not request path.
-- Mirrors meeting_events_tenant_insert (consolidate_rls_nullif migration).
-- A01 Broken Access Control / API3 BOPLA mitigated by separate policies.

-- 1. Enum scope (Prisma-managed type)
CREATE TYPE "TemplateScope" AS ENUM ('platform', 'tenant');

-- 2. Table
CREATE TABLE content_templates (
  id              UUID            NOT NULL PRIMARY KEY,
  tenant_id       UUID,
  scope           "TemplateScope" NOT NULL,
  source_trail_id UUID            REFERENCES trails(id) ON DELETE SET NULL ON UPDATE CASCADE,
  name            VARCHAR(500)    NOT NULL,
  description     VARCHAR(1000),
  version         INTEGER         NOT NULL DEFAULT 1,
  structure       JSONB           NOT NULL,
  created_by      UUID            NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- 3. Logical version key (unique per source trail + version)
CREATE UNIQUE INDEX content_templates_source_trail_version_idx
  ON content_templates (source_trail_id, version)
  WHERE source_trail_id IS NOT NULL;

-- 4. Query indexes
CREATE INDEX content_templates_tenant_idx         ON content_templates (tenant_id);
CREATE INDEX content_templates_tenant_scope_idx   ON content_templates (tenant_id, scope);
CREATE INDEX content_templates_tenant_deleted_idx ON content_templates (tenant_id, deleted_at);
CREATE INDEX content_templates_source_trail_idx   ON content_templates (source_trail_id);

-- 5. RLS
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates FORCE ROW LEVEL SECURITY;

-- READ: platform (NULL) visible to all tenants + own tenant rows
CREATE POLICY content_templates_read ON content_templates
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- INSERT: only own tenant_id — tenants CANNOT forge platform rows (tenant_id=NULL)
CREATE POLICY content_templates_insert ON content_templates
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- UPDATE: row belongs to own tenant (USING) AND stays in own tenant (WITH CHECK)
-- Both clauses required to prevent cross-tenant re-assignment (BOPLA)
CREATE POLICY content_templates_update ON content_templates
  FOR UPDATE
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- DELETE: only own tenant rows
CREATE POLICY content_templates_delete ON content_templates
  FOR DELETE
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 6. Grant to application role
GRANT SELECT, INSERT, UPDATE, DELETE ON content_templates TO metanoia_app;
