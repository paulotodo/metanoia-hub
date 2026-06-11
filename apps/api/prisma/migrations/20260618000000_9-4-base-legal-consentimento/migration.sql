-- Migration: 9-4-base-legal-consentimento
-- Story: Story 9-4 — Base Legal & Histórico de Consentimento (LGPD Art. 7º / 9º)
-- Epic: 9 — LGPD & Privacidade
--
-- Tables created:
--   1. data_processing_registry — global (no tenant_id, no RLS); seeded with 10 operations
--   2. consent_records          — tenant-scoped withdrawal log (RLS NULLIF pattern)
--
-- Architectural decisions (GAP-03 to GAP-06):
--   GAP-03: Trail progress split into 2 entries:
--           "Progressão de Trilhas" (trail-level, certification) and
--           "Progressão de Módulos e Aulas" (granular, daily tracking).
--   GAP-04: Rate limiting for GET /api/v1/privacy/data-processing handled at
--           application layer (PrivacyRateLimitGuard, 30 req/min, in-memory).
--   GAP-05: Withdrawal audit is handled by AuditInterceptor (global, captures
--           PATCH). No manual audit call needed inside consent_records INSERT tx.
--   GAP-06: consent_records is append-only. Double-withdrawal inserts a second
--           row; no uniqueness constraint — full history preserved.

-- ---------------------------------------------------------------------------
-- 1. data_processing_registry
-- ---------------------------------------------------------------------------

CREATE TABLE "data_processing_registry" (
    "id"                 UUID        NOT NULL,
    "operation_name"     TEXT        NOT NULL,
    "legal_basis"        TEXT        NOT NULL,
    "purpose"            TEXT        NOT NULL,
    "data_categories"    TEXT[]      NOT NULL DEFAULT '{}',
    "retention_period"   TEXT        NOT NULL,
    "third_party_sharing" TEXT,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "data_processing_registry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "data_processing_registry_legal_basis_check"
        CHECK ("legal_basis" IN ('consent', 'contract', 'legal_obligation', 'legitimate_interest'))
);

-- No RLS — this table is global (read by public endpoint, no tenant isolation needed)

-- ---------------------------------------------------------------------------
-- 2. consent_records
-- ---------------------------------------------------------------------------

CREATE TABLE "consent_records" (
    "id"           UUID        NOT NULL,
    "user_id"      UUID        NOT NULL,
    "tenant_id"    UUID,
    "consent_type" TEXT        NOT NULL,
    "action"       TEXT        NOT NULL DEFAULT 'withdrawn',
    "timestamp"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consent_records_consent_type_check"
        CHECK ("consent_type" IN ('terms_of_service', 'privacy_policy', 'focus_monitoring')),
    CONSTRAINT "consent_records_action_check"
        CHECK ("action" = 'withdrawn'),
    CONSTRAINT "consent_records_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Indexes
CREATE INDEX "consent_records_user_consent_idx" ON "consent_records" ("user_id", "consent_type");
CREATE INDEX "consent_records_tenant_idx"        ON "consent_records" ("tenant_id");

-- RLS — NULLIF pattern (consistent with audit_events, pastoral_care_notes, etc.)
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
-- Force RLS for the table owner too (prevents bypass via the migration role)
ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;

-- SELECT: tenant isolation (NULL tenant_id = visible to all tenants)
CREATE POLICY "consent_records_tenant_isolation_select"
    ON "consent_records"
    FOR SELECT
    USING (
        NULLIF(current_setting('app.current_tenant_id', true), '')::uuid IS NULL
        OR "tenant_id" IS NULL
        OR "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    );

-- INSERT: must match current tenant (or be tenant-agnostic with null)
CREATE POLICY "consent_records_tenant_isolation_insert"
    ON "consent_records"
    FOR INSERT
    WITH CHECK (
        "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR "tenant_id" IS NULL
    );

-- No UPDATE or DELETE policies — append-only log (GAP-06)

-- ---------------------------------------------------------------------------
-- 3. Seed data_processing_registry (10 operations — LGPD Art. 9º transparency)
--    All UUIDs are v7 (0197b6xx prefix, offline-generated 2026-06-18).
--    ON CONFLICT DO NOTHING ensures idempotent re-runs.
-- ---------------------------------------------------------------------------

INSERT INTO "data_processing_registry"
    ("id", "operation_name", "legal_basis", "purpose", "data_categories", "retention_period", "third_party_sharing", "created_at", "updated_at")
VALUES
    -- 1. Authentication (contract)
    ('0197b600-0001-7000-8000-000000000001',
     'Autenticação e Controle de Acesso',
     'contract',
     'Verificar identidade do usuário e controlar acesso à plataforma.',
     ARRAY['email', 'hashed_password', 'session_token'],
     '90 dias após exclusão da conta',
     'Keycloak (provedor de identidade, mesmo controlador de dados)',
     now(), now()),

    -- 2. Sessions Redis (contract)
    ('0197b600-0002-7000-8000-000000000002',
     'Sessões e Cache de Autenticação',
     'contract',
     'Armazenar sessões ativas e tokens de autenticação para controle de acesso em tempo real.',
     ARRAY['session_tokens', 'tenant_context', 'auth_cache'],
     '7 dias (TTL de sessão)',
     NULL,
     now(), now()),

    -- 3. Trail progress (contract)
    -- GAP-03: split into 2 entries (trail-level vs module/lesson-level)
    ('0197b600-0003-7000-8000-000000000003',
     'Progressão de Trilhas',
     'contract',
     'Rastrear o progresso geral do usuário em trilhas de discipulado para certificação e histórico.',
     ARRAY['trail_progress', 'completion_status', 'completion_date'],
     '36 meses após conclusão da trilha',
     NULL,
     now(), now()),

    -- 4. Module/lesson progress (contract)
    -- GAP-03: second entry for granular tracking
    ('0197b600-0004-7000-8000-000000000004',
     'Progressão de Módulos e Aulas',
     'contract',
     'Rastrear o progresso detalhado do usuário em módulos e aulas individuais de trilhas.',
     ARRAY['lesson_progress', 'module_progress', 'video_intervals', 'completion_timestamps'],
     '36 meses após conclusão da trilha',
     NULL,
     now(), now()),

    -- 5. Meeting attendance (contract)
    ('0197b600-0005-7000-8000-000000000005',
     'Presença em Reuniões',
     'contract',
     'Registrar participação em reuniões presenciais e online para relatórios e acompanhamento pastoral.',
     ARRAY['attendance_records', 'presence_type', 'join_leave_timestamps'],
     '24 meses',
     NULL,
     now(), now()),

    -- 6. Engagement telemetry / focus monitoring (consent)
    ('0197b600-0006-7000-8000-000000000006',
     'Monitoramento de Foco em Reuniões',
     'consent',
     'Coletar sinais de engajamento (câmera ativa, microfone) durante reuniões ao vivo para o Radar Pastoral. Pode ser revogado pelo usuário.',
     ARRAY['camera_status', 'microphone_status', 'focus_heartbeat', 'engagement_score'],
     '12 meses',
     'LiveKit (servidor de mídia em tempo real)',
     now(), now()),

    -- 7. Pastoral care notes (legitimate_interest)
    ('0197b600-0007-7000-8000-000000000007',
     'Notas e Registros Pastorais',
     'legitimate_interest',
     'Registrar observações de cuidado pastoral inseridas por líderes para acompanhamento da jornada espiritual.',
     ARRAY['pastoral_notes', 'care_actions', 'care_timestamps', 'outreach_intents'],
     '5 anos',
     NULL,
     now(), now()),

    -- 8. Pastoral radar (legitimate_interest)
    ('0197b600-0008-7000-8000-000000000008',
     'Radar de Participação Pastoral',
     'legitimate_interest',
     'Calcular indicadores de participação (semáforo pastoral, tendências, alertas) para visibilidade dos líderes.',
     ARRAY['participation_signals', 'radar_scores', 'trend_data', 'alert_flags'],
     '12 meses',
     NULL,
     now(), now()),

    -- 9. Media storage — MinIO (contract)
    ('0197b600-0009-7000-8000-000000000009',
     'Armazenamento de Conteúdo',
     'contract',
     'Armazenar e entregar arquivos de mídia (vídeos, documentos, áudio) utilizados nas trilhas de discipulado.',
     ARRAY['media_files', 'upload_metadata', 'signed_urls'],
     '60 dias após exclusão da trilha',
     'MinIO (armazenamento de objetos, mesma infraestrutura)',
     now(), now()),

    -- 10. Error monitoring — Sentry (legitimate_interest)
    ('0197b600-000a-7000-8000-000000000010',
     'Registro de Erros e Monitoramento',
     'legitimate_interest',
     'Capturar erros de frontend e backend para diagnóstico técnico e manutenção da estabilidade da plataforma.',
     ARRAY['error_traces', 'stack_traces', 'browser_metadata', 'request_context'],
     '30 dias',
     'Sentry (monitoramento de erros)',
     now(), now())

ON CONFLICT ("id") DO NOTHING;
