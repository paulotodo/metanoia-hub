# Research: Base Legal & Histórico de Consentimento (Story 9-4)

## 1. Codebase Archaeology

### 1.1 Módulo `consent/` existente

Localização: `apps/api/src/consent/`

Arquivos identificados:
- `consent.controller.ts` — `@Controller('api/v1/consent')` com `GET /status` e `POST /accept`
- `consent.service.ts` — `getStatus(userId)` e `accept(input, meta)`
- `consent.repository.ts` — `findLatestByUser()` e `create()` via `prisma.client.consent`
- `consent.guard.ts` — `ConsentGuard` e `@SkipConsent()` decorator
- `consent.versions.ts` — `CURRENT_CONSENT_VERSIONS` + `REQUIRED_DOCUMENT_TYPES`
- `consent.module.ts` — exports `ConsentService` + `ConsentGuard`

Estado atual: o módulo registra apenas **aceites** de documentos legais. Sem `action`, sem
withdrawal, sem history endpoint. `consent.versions.ts` já tem nota:
> "Story 9-4 (Release 1b) replaces this with a DB-driven registry plus a complete history of past versions."

### 1.2 Tabela `consents` (schema.prisma linha 195)

```
model Consent {
  id           String   @id @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  tenantId     String?  @map("tenant_id") @db.Uuid
  documentType String   @map("document_type")
  version      String
  ipAddress    String   @map("ip_address")
  userAgent    String   @map("user_agent")
  acceptedAt   DateTime @default(now()) @map("accepted_at")
}
```

Observação: `tenantId` é **nullable** — padrão adotado para documentos aceitos antes
de selecionar tenant. `consent_records` deve herdar essa nullabilidade.

### 1.3 Tipos Zod existentes (`packages/types/src/consent.ts`)

- `ConsentDocumentTypeSchema`: enum `terms_of_service | privacy_policy`
- `AcceptConsentInputSchema`, `AcceptConsentResponseSchema`, `ConsentStatusResponseSchema`
- Necessário adicionar: `ConsentTypeSchema` (estendido), `DataProcessingRegistrySchema`,
  `ConsentRecordSchema`, `ConsentHistoryResponseSchema`, `WithdrawConsentResponseSchema`

### 1.4 Padrão marketing (endpoint público sem RLS)

`apps/api/src/marketing/marketing.service.ts` usa `this.prisma.client.demoRequest.create()`
diretamente (sem extensão RLS). O controller usa `@Public()` e sem `KeycloakAuthGuard`.
`data_processing_registry` segue este padrão exato.

### 1.5 Módulo `audit/` (Story 9-3, mergeado)

`AuditService.createEvent(dto: CreateAuditEventDto): Promise<void>`:
```typescript
interface CreateAuditEventDto {
  userId: string | null;
  action: AuditAction;     // 'create'|'update'|'delete'|'login'|'logout'|...
  resource: string;
  resourceId: string | null;
  ipAddress: string;
  userAgent: string;
  newState: Record<string, unknown> | null;
}
```
A chamada usa `withTenantTx` internamente. Falhas são silenciadas (não propagam). O
módulo `AuditModule` exporta `AuditService`.

### 1.6 Epic 5 — Focus Heartbeat (ponto de integração FR-11)

`apps/api/src/meetings/telemetry/focus-heartbeat.controller.ts` — `POST /api/v1/meetings/:meetingId/focus-heartbeat`
→ `TelemetryService.recordFocusHeartbeat(tenantId, meetingId, userId, visible)`.

O efeito de withdrawal é verificado no método `recordFocusHeartbeat`: antes de persistir
o heartbeat, consultar `consent_records` para verificar se o userId revogou `focus_monitoring`.
Alternativa de guard NestJS descartada (acoplamento excessivo em Controller já isolado).

### 1.7 Padrão withTenantTx

`apps/api/src/prisma/with-tenant-tx.ts` — `withTenantTx(prisma, fn)` executa dentro de
transação com `SET LOCAL app.current_tenant_id = :tenantId`. Obrigatório para todas as
escritas tenant-scoped.

### 1.8 Migration pattern (referência: 9-3)

Arquivo `apps/api/prisma/migrations/20260617000000_9-3-audit-events/migration.sql`:
- DDL + FK + indexes + RLS policies numa migration
- Seeds via SQL `INSERT INTO` quando aplicável
- Próximo número disponível: `20260618000000_9-4-...`

## 2. Decisões Arquiteturais

### DEC-001 — `data_processing_registry` sem tenant_id

**Decisão**: tabela global sem coluna `tenant_id`; sem RLS; leitura via `prisma.client`
(não-extendido). Endpoint público `GET /api/v1/privacy/data-processing` sem `@UseGuards`.

**Justificativa**: o inventário de bases legais é definido pela plataforma, não por tenants.
O Art. 9º LGPD exige transparência pública — não pode exigir autenticação. O padrão marketing
(Cenário 04) valida esse caminho: `prisma.client` sem extensão RLS para tabelas globais.

**Alternativa descartada**: tabela com `tenant_id` redundante (mesmo valor para todos os
registros da plataforma) — introduz complexidade sem benefício; exigiria GET autenticado.

### DEC-002 — `consent_records` separado de `consents`

**Decisão**: tabela nova `consent_records` (log de revogações) separada da tabela `consents`
(log de aceites). Sem `action: "accepted"` retroativo em `consent_records`.

**Justificativa**: C1 da spec confirma: `consents` é append-only de aceites (colunas `documentType,
version, ipAddress, userAgent` sem `action`). Adicionar `action` às `consents` quebraria o
schema e o ConsentGuard existente. Separação limpa de responsabilidades.

### DEC-003 — `consentType` como string enum própria (não reutilizar `documentType`)

**Decisão**: `consent_records.consentType` usa enum próprio (`ConsentTypeSchema`) com valores
`terms_of_service | privacy_policy | focus_monitoring`. O histórico consolida mapeando
`documentType ↔ consentType` para os tipos legais.

**Justificativa**: `focus_monitoring` não tem `documentType` correspondente na tabela `consents`
(não é um documento legal versionado). Enum separado acomoda crescimento de consentimentos
opcionais sem tocar `ConsentDocumentType`.

### DEC-004 — Efeito imediato via query em `consent_records` no recordFocusHeartbeat

**Decisão**: `TelemetryService.recordFocusHeartbeat` consulta `consent_records` antes de
persistir o heartbeat. Se existir registro `{ userId, consentType: 'focus_monitoring', action: 'withdrawn' }`,
retorna early sem persistência.

**Justificativa**: sem cache de invalidação nem event-sourcing. Conformidade com C3 da spec.
Latência aceitável: uma query por heartbeat (≤1/30s), cobertura pelo índice `(user_id, consent_type)`.

### DEC-005 — Módulo `privacy/` novo para o endpoint público

**Decisão**: criar módulo `privacy/` em `apps/api/src/privacy/` com `PrivacyController` +
`PrivacyService`. Não adicionar ao `ConsentModule` (que é tenant-scoped por design).

**Justificativa**: `ConsentController` tem `@UseGuards(KeycloakAuthGuard)` no nível do
controller. Colocar endpoint público nele exigiria `@Public()` com `@SkipConsent()` aninhado,
o que é antipattern. Módulo separado é mais limpo e segue o padrão marketing.

### DEC-006 — ConsentRepository estendido com métodos de history e withdrawal

**Decisão**: `ConsentRepository` recebe novos métodos: `findAllByUser(userId, tenantId)`,
`findWithdrawalsByUser(userId, tenantId)`, `createWithdrawal(input)`. O repository pattern
existente é preservado.

**Justificativa**: NFR-L4 exige extensão sem recriação. `ConsentService` recebe novos métodos
`getHistory()` e `withdrawConsent()` injetando `AuditService`.

## 3. Operações de Tratamento para Seed

Registry inicial (FR-02) — 10 operações:

| operationName | legalBasis | thirdParty |
|---|---|---|
| `user_authentication` | `contract_execution` | Keycloak |
| `trail_progression` | `contract_execution` | — |
| `meeting_attendance` | `contract_execution` | LiveKit |
| `focus_monitoring` | `consent` | LiveKit |
| `pastoral_notes` | `legitimate_interest` | — |
| `participation_radar` | `legitimate_interest` | — |
| `content_storage` | `contract_execution` | MinIO |
| `error_monitoring` | `legitimate_interest` | Sentry |
| `lesson_upload` | `contract_execution` | MinIO |
| `engagement_analytics` | `legitimate_interest` | — |

## 4. Frontend — Tela Privacidade & Consentimento

Rota: `/app/perfil/privacidade` (nova, no route group autenticado `(app)`).
Componente: `PrivacidadeConsentimentoPage` (CSR, `'use client'`).
Hooks: `useConsentHistory()` via TanStack Query, `useWithdrawConsent()` via `useMutation`.
Pattern: `useMutation<undefined, Error, { consentType: ConsentType }>` + `return undefined`
(padrão documentado no projeto para mutations void).

Página pública de transparência: `/privacidade/bases-legais` (no route group `(marketing)`).
Componente Server (SSR, fetch direto ao endpoint público `GET /api/v1/privacy/data-processing`).

## 5. Riscos Identificados

| Risco | Mitigação |
|---|---|
| TelemetryService acoplado a ConsentRepository (cross-bounded-context) | Injetar `ConsentRepository` no `MeetingsModule` via import seletivo ou extrair para `ConsentCheckService` exportado |
| Seed da migration falha em ambiente com seed existente | Usar `INSERT ... ON CONFLICT DO NOTHING` idempotente |
| `consent_records.tenantId` nullable quebra o padrão de RLS obrigatório | Especificar política RLS com `NULLIF` (padrão projeto); registros globais com `tenantId = NULL` ficam fora do escopo da policy |
