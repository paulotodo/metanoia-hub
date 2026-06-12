# Spec: exportacao-dados-pessoais

**Feature:** Story 9-1 — Exportação de Dados Pessoais / Portabilidade LGPD
**Epic:** 9 (LGPD/Privacidade)
**Status:** specify
**Versão:** 1.0.0
**Data:** 2026-06-12

---

## 1. Objetivo

Permitir que qualquer usuário autenticado (Participante, Líder, Admin Tenant) solicite e baixe todos os seus dados pessoais em formato portável (JSON ou PDF), conforme LGPD art. 18 (direito de portabilidade). O export é assíncrono: BullMQ job → polling → signed URL no MinIO.

Esta story leva o Epic 9 a 3/4.

---

## 2. Contexto e Reconciliações Críticas

### 2.1 Módulo privacy já existe (Story 9-4)
- Path canônico: `apps/api/src/privacy/` (privacy.module.ts / privacy.controller.ts / privacy.service.ts + privacy-rate-limit.guard.ts + `__tests__/`)
- A story **ESTENDE** o módulo existente. NÃO cria `apps/api/src/modules/privacy/` (path incorreto do BMad).
- O DataProcessingRegistry do módulo privacy já existe — reusar.

### 2.2 Consent já existe em módulo separado (Story 9-4)
- Path: `apps/api/src/consent/` com `ConsentRepository`
  - `findAllAcceptancesByUser(userId)` — aceites por tipo de documento
  - `findWithdrawalsByUser(userId, tenantId)` — revogações
- O `privacy.service.exportConsentData()` deve **injetar ConsentRepository**, não reimplementar.

### 2.3 Tela de privacidade (Story 9-4)
- Path: `apps/web/app/(authenticated)/app/consumo/perfil/privacidade/page.tsx`
- O fluxo de export ("Exportar meus dados" + "Meus Exports") vai ALI.
- NÃO criar `(authenticated)/settings/privacy/` (path genérico do BMad — errado).

### 2.4 Padrão de job assíncrono (Story 8-7)
- `apps/api/src/reports/reports.service.ts` é o template exato:
  - `BullMqService.createQueue()` em `onModuleInit()`
  - Job status no Redis (`cache:privacy-export-job:<jobId>`)
  - Upload via `StorageService.upload()` + `StorageService.getSignedUrl()`
  - Retry 3x com backoff via BullMQ job options

### 2.5 Gap Central: exportUserData() por módulo
Nenhum dos módulos abaixo possui `exportUserData()` ainda. A story DEVE implementar todos:

| Módulo | Service | Tabelas relevantes |
|--------|---------|-------------------|
| Users | `users.service.ts` | `users` (profile) + `user_tenants` |
| Groups | `groups.service.ts` + `group-members.service.ts` | `group_members`, `groups` |
| Trails | `trails.service.ts` (ou `trail-progress.service.ts`) | `trail_progress`, `module_progress`, `lesson_progress` |
| Meetings | `meetings.service.ts` | `meeting_attendance`, `meeting_participant_records` |
| Pastoral | `pastoral.service.ts` | `pastoral_alerts` (participantId=userId), `pastoral_notes` (participantId=userId) |
| Consent | `privacy.service.ts` → via `ConsentRepository` | `consent`, `consent_records` |
| Audit | `audit.service.ts` | `audit_events` (userId=userId) |

### 2.6 Multi-tenancy — modo privilegiado no worker
O worker de export precisa iterar por TODOS os tenants do usuário (`allTenantIds`). Para cada tenant:
- Usar `prisma.client` diretamente com `{ tenantId }` explícito (mesmo padrão do super-admin — não via RLS, pois o worker é um job privilegiado de sistema)
- Cada `exportUserData(userId, tenantId)` recebe o tenantId explicitamente APENAS no contexto do worker privilegiado — esta é a ÚNICA exceção ao padrão AsyncLocalStorage (o job roda fora de uma request HTTP)

---

## 3. Requisitos Funcionais

### FR-01: Solicitação de export (AC #1)
- `POST /api/v1/privacy/export` com body `{ format: "json" | "pdf" }`
- Validação via `ZodValidationPipe` + `PrivacyExportRequestSchema` em `packages/types/src/privacy/export.ts`
- Retorno 202: `{ data: { jobId, status: "accepted", estimatedCompletionHours: 24 } }`
- Criar registro `privacy_export_jobs` no DB com status `accepted`
- Enfileirar BullMQ job em `queue:privacy-export`: `{ userId, allTenantIds, format, requestedAt, jobId }`
- Se já existe job `accepted` ou `processing`: retornar 409

### FR-02: Job assíncrono de coleta e geração (AC #2)
- Worker itera sobre `allTenantIds` do usuário
- Para cada tenant, chama `exportUserData(userId, tenantId)` de cada módulo
- Gera arquivo JSON com seções por tenant
- Gera arquivo PDF via `pdfkit` (human-readable)
- Upload para MinIO: `exports/global/{userId}/{timestamp}.{format}`
- Signed URL com validade 48h via `StorageService.getSignedUrl()`
- Retry 3x: backoff 1m, 5m, 30m (BullMQ `attempts` + `backoff`)
- Falha após 3 tentativas: mover para `queue:privacy-export:failed`, alertar Sentry
- Deadline: se não completo em 48h, escalar para fila de alta prioridade

### FR-03: Multi-tenant — allTenantIds (AC #2)
- O job payload inclui TODOS os tenants do usuário (via `UserTenant.findMany({ userId })`)
- Dados de cada tenant ficam em seção separada e rotulada no export
- LGPD exige portabilidade de TODOS os dados pessoais independente do tenant ativo

### FR-04: Polling de status (AC #3)
- `GET /api/v1/privacy/export/:jobId`
- Retorna: `{ jobId, status, signedUrl?, expiresAt?, failureReason? }`
- Status: `accepted | processing | completed | failed`
- Signed URL incluída quando `status = "completed"`

### FR-05: Notificação (AC #3)
- In-app: polling no frontend detecta `completed` e exibe toast
- E-mail: enfileirar em `queue:notifications` (stub: `console.log` em dev, mesmo padrão Story 4-3)
- E-mail inclui LINK para página de download (NÃO a signed URL diretamente)
- UI: seção "Meus Exports" na página `/app/consumo/perfil/privacidade`

### FR-06: Completude de dados (AC #2 — teste de completude)
- Teste de integração: criar usuário com dados em TODAS as tabelas → export → verificar presença de todos
- Se um módulo novo adicionar tabela sem atualizar `exportUserData()`: teste FALHA
- Usuário sem dados: export válido com seções vazias (não erro)

### FR-07: Rate limiting (AC #4)
- Máximo 1 export em andamento por usuário (409 se duplicado)
- Reusar `PrivacyRateLimitGuard` já existente ou criar guard específico

---

## 4. Requisitos Não-Funcionais

- **NFR-L1:** Job completado em até 72h; escalação para fila prioritária se não completo em 48h
- **NFR-S1:** Signed URL com 48h de validade; renovável sob demanda
- **NFR-S2:** Arquivo armazenado no MinIO por 30 dias (storage policy `temporary`)
- **NFR-S3:** Conteúdo do e-mail não inclui signed URL (apenas link para página de download)
- **NFR-P1:** Export para usuário com dados em até 5 tenants deve completar em < 30s (job)
- **NFR-T1:** RLS isolation tests obrigatórios para migration `privacy_export_jobs`

---

## 5. Escopo

### 5.1 IN SCOPE
- Endpoint POST /api/v1/privacy/export (criar job)
- Endpoint GET /api/v1/privacy/export/:jobId (polling)
- BullMQ worker de coleta e geração
- Migration: tabela `privacy_export_jobs`
- Zod schemas em `packages/types/src/privacy/export.ts`
- `exportUserData(userId, tenantId)` em: UsersService, GroupsService, MeetingsService, TrailsService (ou serviço de progress), PastoralService, PrivacyService (consent), AuditService
- PDF via pdfkit (ou jsPDF se já presente)
- UI: seção "Meus Exports" em `/app/consumo/perfil/privacidade/page.tsx`
- UI: hook `usePrivacyExport` + polling
- Zod contracts e i18n pt-BR (`privacy.export.*`)
- MSW handlers para testes FE
- Stub de e-mail via `queue:notifications`
- Testes: unit (por módulo), integration (completude), RLS isolation

### 5.2 OUT OF SCOPE
- Geração de PDF com layout visual complexo (suficiente: tabelas simples)
- Envio real de e-mail (apenas stub)
- Renovação automática de signed URL
- Export incremental (deltas)
- Deletion de dados (Story 9-2)

---

## 6. Arquitetura

### 6.1 Novos artefatos
```
apps/api/src/privacy/
  privacy-export.service.ts       # lógica de criação do job + polling
  privacy-export.processor.ts     # BullMQ worker (privileged mode)
  privacy-export.worker.ts        # registrar processor no BullMQ
  dto/privacy-export.dto.ts       # tipos internos
  __tests__/privacy-export.spec.ts

apps/api/src/
  users/
    users.service.ts              # + exportUserData(userId, tenantId)
  group-members/
    group-members.service.ts      # + exportUserData(userId, tenantId)
  meetings/
    meetings.service.ts           # + exportUserData(userId, tenantId)
  content/ (trails)
    trail-progress.service.ts     # + exportUserData(userId, tenantId)
  pastoral/
    pastoral.service.ts           # + exportUserData(userId, tenantId)
  audit/
    audit.service.ts              # + exportUserData(userId, tenantId)
  privacy/
    privacy.service.ts            # + exportConsentData(userId, tenantId)

apps/api/prisma/
  migrations/<timestamp>_add_privacy_export_jobs/migration.sql

packages/types/src/privacy/
  export.ts                       # PrivacyExportRequestSchema, PrivacyExportResponseSchema, etc.

apps/web/app/(authenticated)/app/consumo/perfil/privacidade/
  page.tsx                        # estender com seção "Meus Exports"
  hooks/use-privacy-export.ts     # hook com polling

apps/api/test/rls/
  privacy-export-jobs.rls.spec.ts
```

### 6.2 Privacy Export Job (DB)
```sql
CREATE TABLE privacy_export_jobs (
  id          UUID PRIMARY KEY,
  tenant_id   UUID NOT NULL,          -- tenant ativo no momento da solicitação (RLS)
  user_id     UUID NOT NULL,
  format      VARCHAR(4) NOT NULL,    -- 'json' | 'pdf'
  status      VARCHAR(16) NOT NULL DEFAULT 'accepted',
  all_tenant_ids UUID[] NOT NULL,     -- todos os tenants do usuário (payload do job)
  object_key  TEXT,                   -- MinIO object key quando completed
  signed_url  TEXT,                   -- signed URL quando completed
  expires_at  TIMESTAMPTZ,
  failure_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE privacy_export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY privacy_export_jobs_tenant ON privacy_export_jobs
  USING (NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID = tenant_id);
```

### 6.3 BullMQ Queue Names
- `queue:privacy-export` — jobs de export (BullMQ padrão do projeto com prefixo `queue:`)
- Job key Redis: `cache:privacy-export-job:<jobId>` (mesmo padrão do reports service)

### 6.4 Contrato de exportUserData por módulo
```typescript
// Cada módulo retorna dados zerados (arrays vazios) se usuário não tem dados — NUNCA lança
interface UserExportData {
  profile: {...} | null;
  tenants: Array<{tenantId, role, joinedAt}>;
}
interface GroupsExportData {
  memberships: Array<{groupId, groupName, role, joinedAt}>;
}
interface MeetingsExportData {
  attendance: Array<{meetingId, title, joinTime, leaveTime, presenceType}>;
  participantRecords: Array<{meetingId, response, joinedAt}>;
}
interface TrailsExportData {
  trailProgress: Array<{trailId, trailName, progressPercent, completedAt}>;
  lessonProgress: Array<{lessonId, lessonName, status, completedAt}>;
}
interface PastoralExportData {
  alertsAboutMe: Array<{id, signalType, createdAt}>;
  notesAboutMe: Array<{id, noteType, occurredAt, content}>;
}
interface ConsentExportData {
  acceptances: Array<{documentType, acceptedAt}>;
  withdrawals: Array<{consentType, timestamp}>;
}
interface AuditExportData {
  events: Array<{action, resource, resourceId, timestamp}>;
}
```

---

## 7. Fluxo Principal

```
Usuário → POST /api/v1/privacy/export
  → PrivacyExportService.createJob()
    → Checar job ativo (409 se existe)
    → INSERT privacy_export_jobs (status=accepted)
    → BullMQ.add('privacy-export', { userId, allTenantIds, format, jobId })
  → 202 { data: { jobId, status: "accepted", estimatedCompletionHours: 24 } }

BullMQ Worker (privileged mode):
  → Para cada tenantId em allTenantIds:
    → users.exportUserData(userId, tenantId)        [prisma.client direto]
    → groups.exportUserData(userId, tenantId)
    → meetings.exportUserData(userId, tenantId)
    → trails.exportUserData(userId, tenantId)
    → pastoral.exportUserData(userId, tenantId)
    → privacy.exportConsentData(userId, tenantId)
    → audit.exportUserData(userId, tenantId)
  → Gerar JSON (por tenant) / PDF
  → MinIO upload → getSignedUrl (48h)
  → UPDATE privacy_export_jobs (status=completed, signed_url, expires_at)
  → Redis set cache:privacy-export-job:<jobId>
  → Enfileirar queue:notifications (e-mail stub)

Polling:
  → GET /api/v1/privacy/export/:jobId
  → Retornar status do Redis

UI:
  → Hook usePrivacyExport com polling a cada 5s
  → Toast quando completed
  → Seção "Meus Exports" mostra download link
```

---

## 8. Critérios de Aceitação Consolidados

| # | Critério | Verificação |
|---|----------|-------------|
| AC1 | POST cria job e retorna 202 com jobId | test unitário + integration |
| AC2 | Worker coleta dados de todos módulos e todos tenants | integration completeness test |
| AC3 | Polling retorna status e signed URL quando completed | unit test |
| AC4 | 409 para export duplicado em andamento | unit test |
| AC5 | Retry 3x com backoff; falha → Sentry alert | BullMQ config + unit mock |
| AC6 | UI exibe "Exportar meus dados" na página de privacidade | component test |
| AC7 | UI exibe toast quando export completed (polling) | component test |
| AC8 | Usuário sem dados gera export vazio válido (não erro) | integration |
| AC9 | RLS isolation: tenant A não vê jobs do tenant B | rls spec |
| AC10 | E-mail stub enfileirado em queue:notifications | unit mock |

---

## 9. Dependências

- Story 9-4: módulo privacy + ConsentRepository (CONCLUÍDA)
- Story 8-7: padrão BullMQ + MinIO signed URL (CONCLUÍDA)
- Story 4-3: padrão email stub queue:notifications (CONCLUÍDA)
- Epic 4 (groups), Epic 5 (meetings), Epic 6 (radar/pastoral), Epic 8 (trails): serviços existentes a serem estendidos

---

## 10. Riscos

| Risco | Mitigação |
|-------|-----------|
| `exportUserData()` esquecido em módulo novo | Teste de completude que falha automaticamente |
| Worker privilegiado vaza dados cross-user | Query sempre filtra por `userId` explicitamente |
| PDF pdfkit não disponível no monorepo | Verificar na fase plan; se ausente, instalar em `apps/api` |
| Signed URL expira antes do download | Validade 48h >> tempo esperado de notificação |
| Worker timeout para usuários com muitos dados | NFR-P1: teto de 30s para 5 tenants; benchmark na plan |

---

## Clarifications

_Nenhuma pendente — spec baseada em artefato BMad + reconciliações explícitas do contexto de execução._
