-- Marketing funnel tables — public, tenantless data captured before tenant provisioning.
-- INTENTIONALLY no tenant_id and no RLS policies. These rows belong to the platform,
-- not to any specific church. Documented exception to the multi-tenant rule.

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "church_name" VARCHAR(160) NOT NULL,
    "church_size" VARCHAR(16) NOT NULL,
    "role" VARCHAR(120),
    "ip_address" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "ip_address" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");
CREATE INDEX "demo_requests_created_at_idx" ON "demo_requests"("created_at");
CREATE INDEX "contact_messages_email_idx" ON "contact_messages"("email");
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages"("created_at");

-- NOTE: deliberately no ENABLE ROW LEVEL SECURITY here. These tables are intentionally
-- accessible without a tenant context (writes via public marketing endpoints, reads via
-- internal admin tooling that runs without RLS). See cenario-04 plan for rationale.
