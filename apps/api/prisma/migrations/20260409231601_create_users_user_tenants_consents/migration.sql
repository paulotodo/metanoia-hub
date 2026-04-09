-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_verification',
    "tenant_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tenants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participante',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "document_type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "user_tenants_tenant_id_idx" ON "user_tenants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenants_user_id_tenant_id_key" ON "user_tenants"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "consents_tenant_id_idx" ON "consents"("tenant_id");

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: users table
-- tenant_id is nullable (NULL during registration, assigned at tenant provisioning)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_tenant_isolation" ON "users"
    USING (
        "tenant_id" IS NULL
        OR "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY "users_tenant_insert" ON "users"
    FOR INSERT
    WITH CHECK (true);

-- RLS: user_tenants table
ALTER TABLE "user_tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_tenants" FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_tenants_tenant_isolation" ON "user_tenants"
    USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "user_tenants_tenant_insert" ON "user_tenants"
    FOR INSERT
    WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

-- RLS: consents table
-- tenant_id is nullable (NULL for platform-level consent at registration)
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consents" FORCE ROW LEVEL SECURITY;

CREATE POLICY "consents_tenant_isolation" ON "consents"
    USING (
        "tenant_id" IS NULL
        OR "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY "consents_tenant_insert" ON "consents"
    FOR INSERT
    WITH CHECK (true);
