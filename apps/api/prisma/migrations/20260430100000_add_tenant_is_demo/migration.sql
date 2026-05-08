-- Story 7-2 — flag demo tenants so cleanup is a single cascade-delete on the
-- tenant row, not a per-record sweep. Existing tenants stay non-demo.

ALTER TABLE "tenants"
  ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "tenants_is_demo_idx" ON "tenants"("is_demo") WHERE "is_demo" = true;
