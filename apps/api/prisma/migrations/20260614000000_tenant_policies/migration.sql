-- Story 11-3: TenantPolicies — 1:0..1 with Tenant
-- focusMonitoring maps tenant.focus_indicator_enabled — NOT stored here.
-- 4 toggles (mandatoryCamera, sequentialTrailAccess, autoPresenceTracking, expressMode) stored in JSONB.
-- updated_at managed by Prisma @updatedAt — NO trigger_set_timestamp().

CREATE TABLE "tenant_policies" (
  "id"             uuid NOT NULL,
  "tenant_id"      uuid NOT NULL,
  "policies"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "policy_version" integer NOT NULL DEFAULT 1,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_policies_tenant_id_key" UNIQUE ("tenant_id"),
  CONSTRAINT "tenant_policies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "tenant_policies" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_policies_isolation" ON "tenant_policies"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
