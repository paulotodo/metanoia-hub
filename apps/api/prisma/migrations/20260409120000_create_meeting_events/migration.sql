-- CreateTable
CREATE TABLE "meeting_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "user_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_events_tenant_id_meeting_id_idx" ON "meeting_events"("tenant_id", "meeting_id");

-- Enable RLS
ALTER TABLE "meeting_events" ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner too (prevents bypass)
ALTER TABLE "meeting_events" FORCE ROW LEVEL SECURITY;

-- RLS Policy: tenant isolation
CREATE POLICY "meeting_events_tenant_isolation" ON "meeting_events"
    USING ("tenant_id" = current_setting('app.current_tenant_id')::uuid);

-- RLS Policy: allow insert with matching tenant_id
CREATE POLICY "meeting_events_tenant_insert" ON "meeting_events"
    FOR INSERT
    WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id')::uuid);
