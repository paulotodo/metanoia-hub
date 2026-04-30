-- Cenário 09 Session 3 — Super Admin tenant columns.
-- Extends the `tenants` table with the operational metadata that backs
-- /api/v1/admin/super/tenants endpoints. RLS still applies to the table for
-- non-super-admin queries; the SuperAdminService bypasses RLS via the
-- non-extended Prisma client (see PrismaService.client).

ALTER TABLE "tenants"
  ADD COLUMN "slug" VARCHAR(60),
  ADD COLUMN "plan" VARCHAR(20) NOT NULL DEFAULT 'free',
  ADD COLUMN "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  ADD COLUMN "admin_email" VARCHAR(320),
  ADD COLUMN "provisioning_state" JSONB;

CREATE UNIQUE INDEX "tenants_slug_unique" ON "tenants"("slug");
CREATE INDEX "tenants_status_idx" ON "tenants"("status");
CREATE INDEX "tenants_plan_idx" ON "tenants"("plan");
