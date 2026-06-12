# Plan: exclusao-dados-pessoais

**Feature:** Story 9-2 — Exclusão de Dados Pessoais / Eliminação LGPD
**Epic:** 9 (LGPD/Privacidade)
**Status:** plan-approved
**Data:** 2026-06-12

---

## Sumário

Story 9-2 fecha o Epic 9 implementando o direito de eliminação (LGPD art. 18 VI). A arquitetura espelha a Story 9-1 (export): BullMQ worker assíncrono + método por bounded context + módulo `privacy/` estendido. A diferença central é que deleção é destrutiva e bifásica (soft → hard) com grace period de 7 dias.

**Escopo principal:**
- 3 endpoints REST (`POST /privacy/deletion`, `DELETE /privacy/deletion/:id`, `GET /privacy/deletion/:id`)
- 1 migration: tabela `deletion_requests` + `deleted_at` em 14 tabelas + `anonymized_user_ref` em `audit_events`
- 2 novos services: `PrivacyDeletionService` + `PrivacyDeletionProcessor`
- 7 métodos `softDeleteUserData()` + 7 `hardDeleteUserData()` (1 por bounded context)
- 1 Zod contract em `packages/types`
- Frontend: `DeletionSection` na página de privacidade + banner global `deletion_pending`
- MSW handlers, i18n pt-BR, testes (unit + integration + RLS)

---

## Fase 1: Infraestrutura (contracts + migration)

### F1.1 — Zod contracts em `packages/types/src/privacy/deletion.ts`

**Arquivo novo:** `packages/types/src/privacy/deletion.ts`

Conteúdo:
```ts
export const PRIVACY_DELETION_QUEUE_NAME = 'queue:privacy-deletion';
export const PRIVACY_DELETION_JOB_KEY_PREFIX = 'cache:privacy:deletion-job';
export const PRIVACY_DELETION_GRACE_DAYS = 7;
export const PRIVACY_DELETION_DEADLINE_DAYS = 30;

// Request body: POST /api/v1/privacy/deletion
export const PrivacyDeletionRequestSchema = z.object({
  confirm: z.literal('EXCLUIR'),
});

// Response: 202 após criação
export const PrivacyDeletionResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.literal('pending'),
  cancellableUntil: z.string().datetime(),
  deletionDeadline: z.string().datetime(),
});

// Status poll: GET /api/v1/privacy/deletion/:requestId
export const PrivacyDeletionStatusSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['pending', 'soft_deleted', 'hard_deleted', 'cancelled', 'failed']),
  cancellableUntil: z.string().datetime(),
  deletionDeadline: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

// 422 — guardrail liderança
export const LeaderBlockerSchema = z.object({
  error: z.literal('LEADER_ACTIVE_GROUPS'),
  groups: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
});

// BullMQ job payload
export interface PrivacyDeletionJobPayload {
  requestId: string;
  userId: string;
  allTenantIds: string[];
  requestedAt: string;
  cancellableUntil: string;
  deletionDeadline: string;
}
```

Adicionar ao `packages/types/src/privacy/index.ts`:
```ts
export * from './deletion';
```

Adicionar ao `packages/types/src/index.ts`:
```ts
// privacy/deletion já está via privacy/index.ts se index exportar tudo
```

### F1.2 — Migration: `20260620000000_9-2-deletion-requests`

**Arquivo:** `apps/api/prisma/migrations/20260620000000_9-2-deletion-requests/migration.sql`

```sql
-- Migration: 9-2 Deletion Requests (Story 9-2 / LGPD Art. 18 VI)
-- 1) Cria tabela deletion_requests
-- 2) Adiciona deleted_at em 14 tabelas para soft-delete
-- 3) Adiciona anonymized_user_ref em audit_events para anonimização

-- 1. deletion_requests
CREATE TABLE "deletion_requests" (
    "id"                UUID        NOT NULL,
    "tenant_id"         UUID        NOT NULL,
    "user_id"           UUID        NOT NULL,
    "status"            TEXT        NOT NULL DEFAULT 'pending',
    "all_tenant_ids"    UUID[]      NOT NULL DEFAULT '{}',
    "cancellable_until" TIMESTAMPTZ NOT NULL,
    "deletion_deadline" TIMESTAMPTZ NOT NULL,
    "cancelled_at"      TIMESTAMPTZ,
    "confirmed_at"      TIMESTAMPTZ,
    "completed_at"      TIMESTAMPTZ,
    "failure_reason"    TEXT,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_deletion_requests_user_id"     ON deletion_requests(user_id);
CREATE INDEX "idx_deletion_requests_tenant_user" ON deletion_requests(tenant_id, user_id);
CREATE INDEX "idx_deletion_requests_status"      ON deletion_requests(status)
    WHERE status IN ('pending', 'soft_deleted');

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deletion_requests_tenant"
    ON deletion_requests
    USING (NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID = tenant_id);

-- 2. deleted_at em 14 tabelas
ALTER TABLE user_tenants         ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE group_members        ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE meeting_attendance   ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE meeting_telemetry    ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE meeting_participants ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE meeting_events       ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE reflections          ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE pastoral_alerts      ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE pastoral_actions     ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE pastoral_notes       ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE outreach_intents     ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE lesson_progress      ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE module_progress      ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE trail_progress       ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- Índice parcial para filtrar registros não deletados (common query pattern)
CREATE INDEX idx_user_tenants_not_deleted       ON user_tenants(tenant_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_group_members_not_deleted      ON group_members(tenant_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lesson_progress_not_deleted    ON lesson_progress(tenant_id, user_id) WHERE deleted_at IS NULL;

-- 3. anonymized_user_ref em audit_events (para anonimização no hard-delete)
ALTER TABLE audit_events ADD COLUMN "anonymized_user_ref" TEXT;
```

Atualizar `schema.prisma` para refletir as novas colunas em cada modelo + novo model `DeletionRequest`.

### F1.3 — Schema Prisma: DeletionRequest + `deletedAt` nos 14 modelos

Adicionar ao `schema.prisma`:
```prisma
model DeletionRequest {
  id               String    @id @db.Uuid
  tenantId         String    @map("tenant_id") @db.Uuid
  userId           String    @map("user_id") @db.Uuid
  status           String    @default("pending")
  allTenantIds     String[]  @map("all_tenant_ids") @db.Uuid
  cancellableUntil DateTime  @map("cancellable_until") @db.Timestamptz
  deletionDeadline DateTime  @map("deletion_deadline") @db.Timestamptz
  cancelledAt      DateTime? @map("cancelled_at") @db.Timestamptz
  confirmedAt      DateTime? @map("confirmed_at") @db.Timestamptz
  completedAt      DateTime? @map("completed_at") @db.Timestamptz
  failureReason    String?   @map("failure_reason")
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  @@index([userId])
  @@index([tenantId, userId])
  @@map("deletion_requests")
}
```

Adicionar `deletedAt DateTime? @map("deleted_at") @db.Timestamptz` a cada um dos 14 modelos listados no `data-model.md`.

Adicionar `anonymizedUserRef String? @map("anonymized_user_ref")` ao model `AuditEvent`.

---

## Fase 2: Backend — Services e Worker

### F2.1 — `PrivacyDeletionService`

**Arquivo novo:** `apps/api/src/privacy/privacy-deletion.service.ts`

Responsabilidades:
1. `createJob(userId, tenantId)` — valida guardrail liderança, cria `DeletionRequest`, enfileira 2 jobs BullMQ, atualiza `User.status → 'deletion_pending'`.
2. `cancelRequest(requestId, userId)` — valida `cancellableUntil`, atualiza `DeletionRequest.status → 'cancelled'`, restaura `User.status → 'active'`.
3. `getStatus(requestId, userId)` — retorna `DeletionRequest` filtrado por userId (ownership check).
4. `softDeleteAllTenants(payload)` — chamado pelo worker: itera `allTenantIds`, executa `softDeleteUserData(userId, tenantId)` por módulo.
5. `hardDeleteAllTenants(payload)` — chamado pelo worker: itera `allTenantIds`, executa `hardDeleteUserData(userId, tenantId)` por módulo em transação por tenant, anonimiza audit, limpa Redis + MinIO.
6. `handleJobFailure(requestId, reason)` — atualiza status + Sentry + DPO alert.

Padrão de injeção:
```ts
constructor(
  private readonly bullMqService: BullMqService,
  private readonly prisma: PrismaService,
  private readonly redis: RedisService,
  private readonly storage: StorageService,
  private readonly usersService: UsersService,
  private readonly groupMembersService: GroupMembersService,
  private readonly meetingsService: MeetingsService,
  private readonly progressService: ProgressService,
  private readonly pastoralService: PastoralService,
  private readonly consentService: ConsentService, // NÃO deleta — apenas para verificação
  private readonly auditService: AuditService,
) {}
```

Backoff customizado (BullMQ `custom` type via `CustomBackoffStrategy`):
```ts
// Delays: 1h, 4h, 12h
const DELETION_BACKOFF_DELAYS_MS = [3_600_000, 14_400_000, 43_200_000];
```

### F2.2 — `PrivacyDeletionProcessor`

**Arquivo novo:** `apps/api/src/privacy/privacy-deletion.processor.ts`

Skeleton idêntico ao `PrivacyExportProcessor`:
```ts
@Injectable()
export class PrivacyDeletionProcessor implements OnModuleInit {
  onModuleInit(): void {
    this.bullMqService.createWorker(PRIVACY_DELETION_QUEUE_NAME, async (job) => {
      if (job.name === 'soft-delete-user-data') {
        // Verificar status != 'cancelled' antes de executar
        await this.privacyDeletionService.softDeleteAllTenants(job.data);
      }
      if (job.name === 'hard-delete-user-data') {
        await this.privacyDeletionService.hardDeleteAllTenants(job.data);
      }
    });
  }
}
```

### F2.3 — `softDeleteUserData()` por módulo (7 services)

Adicionar a cada service o método:
```ts
async softDeleteUserData(userId: string, tenantId: string): Promise<void>
```

| Service | Operação |
|---------|----------|
| `UsersService` | `UPDATE users SET status='deletion_pending' WHERE id=userId` (já feito no createJob); `UPDATE user_tenants SET deleted_at=NOW() WHERE user_id=userId` |
| `GroupMembersService` | `UPDATE group_members SET deleted_at=NOW() WHERE user_id=userId AND tenant_id=tenantId` |
| `MeetingsService` | `UPDATE meeting_attendance, meeting_telemetry, meeting_participants, meeting_events SET deleted_at=NOW() WHERE user_id=userId AND tenant_id=tenantId` |
| `ProgressService` | `UPDATE lesson_progress, module_progress, trail_progress SET deleted_at=NOW() WHERE user_id=userId AND tenant_id=tenantId` |
| `PastoralService` | `UPDATE pastoral_alerts(participantId), pastoral_actions(participantId), pastoral_notes(participantId), outreach_intents(createdByUserId) SET deleted_at=NOW() WHERE ... AND tenant_id=tenantId`; `reflections` via `UPDATE reflections SET deleted_at=NOW() WHERE leader_id=userId AND tenant_id=tenantId` |
| `AuditService` | No-op no soft-delete; apenas no hard-delete há anonimização |
| `ConsentService` | No-op — RETER (LGPD art. 16) |

### F2.4 — `hardDeleteUserData()` por módulo (7 services)

Adicionar a cada service o método:
```ts
async hardDeleteUserData(userId: string, tenantId: string, tx: Prisma.TransactionClient): Promise<void>
```

Cada método recebe a `TransactionClient` da transação do worker (hard-delete transacional por tenant).

| Service | Operação |
|---------|----------|
| `UsersService` | `DELETE FROM user_tenants WHERE user_id=userId AND tenant_id=tenantId`; `UPDATE users SET name='Usuário Removido', email='removed-{hash}@deleted.invalid', status='deleted' WHERE id=userId` (hard-delete do perfil é UPDATE, não DELETE — mantém FK) |
| `GroupMembersService` | `DELETE FROM group_members WHERE user_id=userId AND tenant_id=tenantId` |
| `MeetingsService` | `DELETE FROM meeting_attendance, meeting_telemetry WHERE user_id=userId AND tenant_id=tenantId`; `UPDATE meeting_participants SET user_id=NULL WHERE user_id=userId AND tenant_id=tenantId` (nullable); `UPDATE meeting_events SET user_id=NULL WHERE user_id=userId AND tenant_id=tenantId` (nullable) |
| `ProgressService` | `DELETE FROM lesson_progress, module_progress, trail_progress WHERE user_id=userId AND tenant_id=tenantId` |
| `PastoralService` | `DELETE FROM pastoral_alerts, pastoral_actions, pastoral_notes WHERE participant_id=userId AND tenant_id=tenantId`; `UPDATE outreach_intents SET created_by_user_id=NULL WHERE created_by_user_id=userId AND tenant_id=tenantId`; `UPDATE reflections SET leader_id=NULL... ` (se FK nullable) ou `DELETE FROM reflections WHERE leader_id=userId AND tenant_id=tenantId` |
| `AuditService` | `UPDATE audit_events SET user_id=NULL, anonymized_user_ref='anonymous-{hash}' WHERE user_id=userId AND tenant_id=tenantId` (via `prisma.client.$executeRaw` — bypass RLS, worker privilegiado) |
| `ConsentService` | No-op — RETER |

**Nota sobre `reflections`**: coluna `leader_id` não é nullable no schema atual. Migration 9-2 adiciona `nullable` ao campo ou a operação é `DELETE`. Decisão: **DELETE reflections do líder** (são dados pessoais do líder-autor; outros participantes não estão expostos pela linha de reflection).

### F2.5 — Anonimização audit + limpeza Redis/MinIO (no hard-delete worker)

Após `hardDeleteUserData()` por todos os tenants:

```ts
// 1. Redis SCAN + DEL (por userId)
// 2. MinIO: listar e deletar objetos sob 'user/{userId}/' e 'exports/global/{userId}/'
// 3. Keycloak: deletar chaves session:{userId}:* do Redis
// 4. UPDATE deletion_requests SET status='hard_deleted', completed_at=NOW() WHERE id=requestId
// 5. UPDATE users SET status='deleted' WHERE id=userId
// 6. Audit event: privacy.deletion.completed (via AuditService.log — usa prisma.client)
```

### F2.6 — Controller: 3 novos endpoints

Adicionar a `PrivacyController`:

```ts
@UseGuards(KeycloakAuthGuard)
@Post('deletion')
@HttpCode(202)
@UsePipes(new ZodValidationPipe(PrivacyDeletionRequestSchema))
async createDeletion(@Body() body: PrivacyDeletionRequest): Promise<{ data: PrivacyDeletionResponse }>

@UseGuards(KeycloakAuthGuard)
@Delete('deletion/:requestId')
@HttpCode(200)
async cancelDeletion(@Param('requestId') requestId: string): Promise<{ data: PrivacyDeletionStatus }>

@UseGuards(KeycloakAuthGuard)
@Get('deletion/:requestId')
async getDeletionStatus(@Param('requestId') requestId: string): Promise<{ data: PrivacyDeletionStatus }>
```

### F2.7 — Atualizar `POST /privacy/export` com verificação deletion_pending (Q4/dec-012)

Em `PrivacyExportService.createJob()`, antes do check de job existente:
```ts
const user = await this.prisma.client.user.findUnique({
  where: { id: userId },
  select: { status: true },
});
if (user?.status === 'deletion_pending') {
  throw new ConflictException(
    'Cannot create export: account deletion in progress.',
  );
}
```

### F2.8 — Atualizar `PrivacyModule`

Adicionar `PrivacyDeletionService` e `PrivacyDeletionProcessor` a `providers` e atualizar `exports`.

---

## Fase 3: Frontend

### F3.1 — `DeletionSection` component

**Arquivo novo:** inline na página de privacidade ou componente separado.

Estados UI:
1. `idle` — botão "Solicitar exclusão da conta" + diálogo explicativo
2. `leader_blocked` — lista de grupos ativos com links para transferência / dissolução
3. `pending` — banner + countdown + botão "Cancelar solicitação"
4. `cancelled` — volta ao `idle` com mensagem de confirmação

Diálogo explicativo lista:
- O que SERÁ removido (por módulo)
- O que SERÁ RETIDO (audit, consentimentos)
- Campo de confirmação: `input type="text"` exige digitação de "EXCLUIR"

### F3.2 — Hook `use-privacy-deletion.ts`

**Arquivo novo:** `apps/web/src/hooks/use-privacy-deletion.ts`

Mutations TanStack Query:
- `useDeletionRequest()` — `POST /api/v1/privacy/deletion`
- `useCancelDeletion()` — `DELETE /api/v1/privacy/deletion/:requestId`
- `useDeletionStatus(requestId)` — `GET /api/v1/privacy/deletion/:requestId`

### F3.3 — Banner global `DeletionPendingBanner`

**Arquivo novo:** `apps/web/src/components/deletion-pending-banner.tsx`

Condição de exibição: `useAuth()` retorna `user.status === 'deletion_pending'`.
Conteúdo: "Sua conta será excluída em {N} dias. [Cancelar solicitação]"

Posição: no layout autenticado `apps/web/app/(authenticated)/layout.tsx`, abaixo do header.

Para obter `user.status` no layout (Server Component ou Client): verificar se `useAuth()` hook já inclui `status`. Se não, adicionar `status` ao payload JWT Keycloak ou ao endpoint de perfil.

### F3.4 — Atualizar página de privacidade

Adicionar `DeletionSection` após `ExportSection` em `privacidade/page.tsx`.

### F3.5 — i18n pt-BR

Adicionar ao `apps/web/messages/pt-BR.json` em `"privacy"`:

```json
"deletion": {
  "title": "Excluir minha conta",
  "description": "Solicite a exclusão permanente de todos os seus dados pessoais.",
  "confirmPlaceholder": "Digite EXCLUIR para confirmar",
  "confirmLabel": "Confirmação",
  "confirmMismatch": "Digite exatamente EXCLUIR para continuar",
  "requestButton": "Solicitar exclusão",
  "cancelButton": "Cancelar solicitação",
  "statusPending": "Sua conta será excluída em {days} dias.",
  "statusCancelled": "Solicitação cancelada. Sua conta está ativa.",
  "statusCompleted": "Seus dados foram removidos.",
  "willRemove": "O que será removido",
  "willRetain": "O que será mantido",
  "retainAudit": "Registros de auditoria (anonimizados)",
  "retainConsent": "Histórico de consentimentos (base legal LGPD art. 16)",
  "leaderBlocked": "Você lidera {n} grupo(s) ativo(s). Transfira a liderança antes de solicitar a exclusão.",
  "transferLeadership": "Transferir Liderança",
  "dissolveGroup": "Dissolver grupo",
  "gracePeriodDays": "Período de cancelamento: 7 dias",
  "deadlineDays": "Prazo de exclusão: até 30 dias"
}
```

### F3.6 — MSW handlers

Adicionar a `apps/web/mocks/handlers/privacy.ts`:
- `POST /api/v1/privacy/deletion` — retorna 202 ou 422 (leader_blocked) ou 409 (deletion_pending)
- `DELETE /api/v1/privacy/deletion/:requestId` — retorna 200 ou 403
- `GET /api/v1/privacy/deletion/:requestId` — retorna status

---

## Fase 4: Testes

### F4.1 — Unit tests (por módulo)

Para cada `softDeleteUserData()` e `hardDeleteUserData()`:
- Verifica que o método é idempotente (aplicar 2x = mesma result)
- Verifica que o escopo é por `tenantId` (não vaza entre tenants)
- Verifica que `consents` NÃO são afetados

### F4.2 — Integration test: cascade completo

**Arquivo:** `apps/api/src/__tests__/privacy-deletion.integration.spec.ts`

Cenário: criar usuário com dados em todos os módulos → executar pipeline completa → verificar por tabela:
1. Criar tenant A + tenant B para o mesmo usuário
2. Inserir dados em: group_members, meeting_attendance, lesson_progress, pastoral_alerts, audit_events, reflections
3. Chamar `softDeleteAllTenants()` → verificar `deleted_at IS NOT NULL` em todas as tabelas
4. Chamar `hardDeleteAllTenants()` → verificar:
   - `users`: name='Usuário Removido', email anonimizado, status='deleted'
   - `audit_events`: user_id=NULL, anonymized_user_ref='anonymous-...'
   - `consents`: INTACTOS
   - Tabelas soft-deletadas: registros removidos (DELETE)
   - `participant_radar_status`: removido via CASCADE

### F4.3 — RLS isolation test

**Arquivo:** `apps/api/test/rls/deletion-requests.rls.spec.ts`

Padrão das RLS specs do projeto (PrismaPg adapter, UUIDs fixos hex, users globais, cleanup só mutável):
- Verificar que tenant A não vê `deletion_requests` de tenant B
- Verificar que worker (bypass RLS via `prisma.client`) vê todos os tenants
- Verificar que UPDATE no soft-delete respeita `tenant_id` (não afeta outros tenants)

### F4.4 — Teste de guardrail

- Usuário líder com grupo ativo → 422 + lista de grupos
- Usuário líder com grupo único (sem outros membros) → 422 + opção dissolve
- Usuário não-líder → 202

### F4.5 — Teste de idempotência

- Duas chamadas `POST /privacy/deletion` do mesmo usuário → retornam o mesmo `requestId`
- Worker executado 2x no soft-delete → resultado idêntico (idempotência via `deleted_at`)

---

## Fase 5: Integração final

### F5.1 — Atualizar `PrivacyModule`

```ts
providers: [
  PrivacyService,
  PrivacyRateLimitGuard,
  PrivacyExportService,
  PrivacyExportProcessor,
  PrivacyDeletionService,   // novo
  PrivacyDeletionProcessor, // novo
],
exports: [PrivacyExportService, PrivacyDeletionService],
```

### F5.2 — Smoke test manual

Com `docker-compose.test.yml`:
1. Criar usuário via seed
2. `POST /api/v1/privacy/deletion` com `{ "confirm": "EXCLUIR" }`
3. Verificar `deletion_requests` criada, `User.status = 'deletion_pending'`
4. `GET /api/v1/privacy/deletion/:id` → status `pending`
5. Simular worker soft-delete (invocar diretamente)
6. Verificar `deleted_at` nas tabelas
7. `DELETE /api/v1/privacy/deletion/:id` após cancelamento → 403 (fora do grace period simulado)

---

## Ordem de execução (tasks)

```
T1: F1.1 — Zod contracts (packages/types)
T2: F1.2 + F1.3 — Migration SQL + schema.prisma
T3: F2.3 — softDeleteUserData() nos 7 services
T4: F2.4 + F2.5 — hardDeleteUserData() nos 7 services + cleanup Redis/MinIO
T5: F2.1 + F2.2 — PrivacyDeletionService + PrivacyDeletionProcessor
T6: F2.6 + F2.7 + F2.8 — Controller endpoints + export fix + module update
T7: F3.1 + F3.2 + F3.3 + F3.4 + F3.5 + F3.6 — Frontend completo
T8: F4.1 + F4.2 + F4.3 + F4.4 + F4.5 — Testes
T9: F5.1 + F5.2 — Integração final + smoke test
```

---

## Dependências de arquivos

| Arquivo | Ação | Fase |
|---------|------|------|
| `packages/types/src/privacy/deletion.ts` | CRIAR | F1.1 |
| `packages/types/src/privacy/index.ts` | EDITAR — adicionar export | F1.1 |
| `apps/api/prisma/migrations/20260620000000_9-2-deletion-requests/migration.sql` | CRIAR | F1.2 |
| `apps/api/prisma/schema.prisma` | EDITAR — DeletionRequest + deletedAt + anonymizedUserRef | F1.3 |
| `apps/api/src/users/users.service.ts` | EDITAR — softDelete + hardDelete | F2.3 |
| `apps/api/src/group-members/group-members.service.ts` | EDITAR | F2.3 |
| `apps/api/src/meetings/meetings.service.ts` | EDITAR | F2.3 |
| `apps/api/src/content/progress/progress.service.ts` | EDITAR | F2.3 |
| `apps/api/src/pastoral/pastoral.service.ts` | EDITAR | F2.3 |
| `apps/api/src/audit/audit.service.ts` | EDITAR | F2.4 |
| `apps/api/src/consent/consent.service.ts` | EDITAR — no-op stub | F2.3 |
| `apps/api/src/privacy/privacy-deletion.service.ts` | CRIAR | F2.1 |
| `apps/api/src/privacy/privacy-deletion.processor.ts` | CRIAR | F2.2 |
| `apps/api/src/privacy/privacy-export.service.ts` | EDITAR — 409 deletion_pending | F2.7 |
| `apps/api/src/privacy/privacy.controller.ts` | EDITAR — 3 novos endpoints | F2.6 |
| `apps/api/src/privacy/privacy.module.ts` | EDITAR — providers/exports | F2.8 |
| `apps/web/src/hooks/use-privacy-deletion.ts` | CRIAR | F3.2 |
| `apps/web/src/components/deletion-pending-banner.tsx` | CRIAR | F3.3 |
| `apps/web/app/(authenticated)/layout.tsx` | EDITAR — banner | F3.3 |
| `apps/web/app/(authenticated)/app/consumo/perfil/privacidade/page.tsx` | EDITAR — DeletionSection | F3.4 |
| `apps/web/messages/pt-BR.json` | EDITAR — privacy.deletion.* | F3.5 |
| `apps/web/mocks/handlers/privacy.ts` | EDITAR — deletion handlers | F3.6 |
| `apps/api/src/__tests__/privacy-deletion.integration.spec.ts` | CRIAR | F4.2 |
| `apps/api/test/rls/deletion-requests.rls.spec.ts` | CRIAR | F4.3 |

---

## Considerações de segurança (OWASP)

| Vetor | Mitigação |
|-------|-----------|
| A01 Broken Access Control | Ownership check em todos os endpoints: `requestId` pertence ao `userId` autenticado |
| A03 Injection | `userId` via `getRequestContext()` (não input do usuário); `sha256` via `crypto` (stdlib Node) |
| A04 Insecure Design | Confirmação explícita `"EXCLUIR"` previne ação acidental; grace period de 7 dias |
| A05 Security Misconfiguration | Worker privilegiado usa `prisma.client` isolado; RLS ativo para HTTP |
| A07 Auth Failures | `KeycloakAuthGuard` em todos os endpoints de deleção |
| A09 Logging Failures | Audit event registrado na criação, cancelamento e conclusão |
| PII Leakage | `anonymized_user_ref` via hash não-reversível; email anonimizado só no hard-delete; Redis limpo |
| DoS via deletion storm | Idempotência: 1 request ativo por usuário; rate-limit via `PrivacyRateLimitGuard` |
