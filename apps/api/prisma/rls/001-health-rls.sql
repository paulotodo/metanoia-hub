-- Enable RLS on _health table
ALTER TABLE _health ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner
ALTER TABLE _health FORCE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent re-application)
DROP POLICY IF EXISTS rls_health_select ON _health;
DROP POLICY IF EXISTS rls_health_insert ON _health;
DROP POLICY IF EXISTS rls_health_update ON _health;
DROP POLICY IF EXISTS rls_health_delete ON _health;

-- Policy: SELECT only rows matching current tenant
-- Uses nullif to handle empty string default, coalesce for missing setting
CREATE POLICY rls_health_select ON _health
  FOR SELECT
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

-- Policy: INSERT only with matching tenant_id
CREATE POLICY rls_health_insert ON _health
  FOR INSERT
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

-- Policy: UPDATE only own tenant rows
CREATE POLICY rls_health_update ON _health
  FOR UPDATE
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

-- Policy: DELETE only own tenant rows
CREATE POLICY rls_health_delete ON _health
  FOR DELETE
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
