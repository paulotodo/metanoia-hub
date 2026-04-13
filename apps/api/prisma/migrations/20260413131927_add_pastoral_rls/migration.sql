-- Row Level Security for pastoral radar tables
-- Pattern: tenant_id = current_setting('app.current_tenant_id')::uuid
-- Set by prisma.extension.ts via SET LOCAL before each query

-- tenants
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenants"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- groups
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "groups"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- group_members
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "group_members"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- pastoral_alerts
ALTER TABLE "pastoral_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pastoral_alerts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pastoral_alerts"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- pastoral_actions
ALTER TABLE "pastoral_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pastoral_actions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pastoral_actions"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- pastoral_notes
ALTER TABLE "pastoral_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pastoral_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pastoral_notes"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
