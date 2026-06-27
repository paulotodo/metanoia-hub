-- Story 16-1 (FR78): Preferências granulares de notificação por tipo e canal.
-- RLS espelha padrão da migration 14-1 (notifications).
-- id gerado pela aplicação (uuidv7) — sem DEFAULT.
-- Depende de: 20260629000000_14-1-notifications (notification_type, notification_channel enums)
--             20260629000001_14-3-email-notification-types (export_ready, content_new)

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notification_type" "notification_type" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- Unique index para UPSERT ON CONFLICT
CREATE UNIQUE INDEX "notif_prefs_user_tenant_type_channel_uq"
    ON "notification_preferences" ("user_id", "tenant_id", "notification_type", "channel");

-- Índice de tenant para RLS e queries filtradas
CREATE INDEX "notification_preferences_tenant_idx"
    ON "notification_preferences" ("tenant_id");

-- Enable RLS
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;

-- Policy de isolamento (espelha padrão 14-1)
CREATE POLICY "tenant_isolation" ON "notification_preferences"
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
