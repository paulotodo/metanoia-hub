-- Migration 14-4: integration_health_log table
-- Story 14-4 — Health Check de Integrações & Dashboard Super Admin (NFR-I5)
-- Platform-level: sem tenant_id (super admin only, escrita via BYPASSRLS)
-- Spec §FR-001, §D-001, data-model.md

-- 1. Enum de status
CREATE TYPE "integration_health_status" AS ENUM ('healthy', 'degraded', 'unhealthy');

-- 2. Tabela principal
CREATE TABLE "integration_health_log" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "integration_name" VARCHAR(64)  NOT NULL,
    "status"           "integration_health_status" NOT NULL,
    "latency_ms"       INTEGER,
    "message"          TEXT,
    "checked_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "integration_health_log_pkey" PRIMARY KEY ("id")
);

-- 3. Índice para queries de histórico por integração (sparkline 24h)
CREATE INDEX "integration_health_log_name_checked_idx"
    ON "integration_health_log" ("integration_name", "checked_at" DESC);

-- 4. RLS: habilitar row-level security
ALTER TABLE "integration_health_log" ENABLE ROW LEVEL SECURITY;

-- 5. Política de leitura: super_admin via endpoint REST (cliente app com USING true)
--    Escrita somente via createPrivilegedClient() que usa BYPASSRLS — sem WITH CHECK
CREATE POLICY "platform_read"
    ON "integration_health_log"
    FOR SELECT
    USING (true);
