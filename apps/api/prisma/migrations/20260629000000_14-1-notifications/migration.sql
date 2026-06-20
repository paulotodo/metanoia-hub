-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('pastoral_alert', 'group_message', 'content_update', 'meeting_reminder', 'system');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'failed', 'read');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'pending',
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_status_created_idx" ON "notifications"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_tenant_idx" ON "notifications"("tenant_id");

-- Enable RLS
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: tenant isolation (no IS NULL branch per spec Decision 4)
CREATE POLICY "tenant_isolation" ON "notifications"
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
