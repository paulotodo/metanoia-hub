# Research: exclusao-dados-pessoais

**Feature:** Story 9-2 — Exclusão de Dados Pessoais / Eliminação LGPD
**Data:** 2026-06-12

---

## 1. Análise do código existente (Story 9-1)

### 1.1 Padrão BullMQ (PrivacyExportProcessor)

O `PrivacyExportProcessor` estabelece o skeleton do worker assíncrono de privacidade:
- `OnModuleInit` registra worker no `createWorker(QUEUE_NAME, handler)`.
- Job retries: `attempts: 3, backoff: { type: 'exponential', delay: 60_000 }`.
- Em falha: `handleJobFailure()` atualiza DB + Redis, depois `throw error` para BullMQ aplicar retry.
- Não usa `AsyncLocalStorage` (modo privilegiado — sem contexto HTTP).

Para deleção o padrão é idêntico, mas backoff maior: 1h/4h/12h (job destrutivo).

### 1.2 Padrão `exportUserData()` por módulo

Implementado em 7 services (confirmado via `grep`):

| Service | Método | Nota |
|---------|--------|------|
| `UsersService` | `exportUserData(userId, _tenantId)` | `_tenantId` ignorado (global) |
| `GroupMembersService` | `exportUserData(userId, tenantId)` | per-tenant |
| `MeetingsService` | `exportUserData(userId, tenantId)` | per-tenant |
| `ProgressService` | `exportUserData(userId, tenantId)` | per-tenant |
| `PastoralService` | `exportUserData(userId, tenantId)` | per-tenant |
| `AuditService` | `exportUserData(userId, tenantId)` | per-tenant |
| `ConsentService` | `exportConsentData(userId, tenantId)` | nome diferente |

Story 9-2 espelha esse padrão com `softDeleteUserData()` + `hardDeleteUserData()` em cada service.

### 1.3 Tabelas sem `deletedAt` (precisam de migration)

Análise do `schema.prisma` — tabelas que a spec §3 marca para soft-delete mas **não têm** `deleted_at`:

| Tabela | Modelo Prisma | Status FK para `users` |
|--------|--------------|------------------------|
| `group_members` | `GroupMember` | `userId FK → users.id` |
| `meeting_attendance` | `MeetingAttendance` | `userId NOT NULL` |
| `meeting_telemetry` | `MeetingTelemetry` | `userId NOT NULL` |
| `meeting_participants` | `MeetingParticipantRecord` | `userId nullable` |
| `meeting_events` | `MeetingEvent` | `userId nullable` |
| `reflections` | `Reflection` | `leaderId FK` (sem FK explícita para users) |
| `pastoral_alerts` | `PastoralAlert` | `participantId FK → users(alerts)` |
| `pastoral_actions` | `PastoralAction` | `participantId FK → users(actions)` |
| `pastoral_notes` | `PastoralNote` | `participantId FK → users(notes)` |
| `outreach_intents` | `OutreachIntent` | `createdByUserId` (sem FK Prisma explícita para users) |

**Tabelas COM `onDelete: Cascade` para users (não precisam de soft-delete na migration 9-2, serão removidas com hard-delete via Cascade):**
- `participant_radar_status` — `onDelete: Cascade, onUpdate: Cascade` ✓
- `participant_status_improved` — `onDelete: Cascade, onUpdate: Cascade` ✓

**Tabelas que usam soft-delete via `deletedAt` já existente (verificado em schema):**
- `lesson_progress` (offset 707) — não tem `deleted_at` atualmente
- `module_progress` (offset 731) — não tem `deleted_at` atualmente  
- `trail_progress` (offset 748) — não tem `deleted_at` atualmente
- `user_tenants` (offset 181) — não tem `deleted_at` atualmente

**Conclusão**: migration 9-2 precisa adicionar `deleted_at TIMESTAMPTZ` a 14 tabelas + criar `deletion_requests`.

### 1.4 AuditEvent — anonimização via raw SQL

`audit_events.user_id` é `String? @map("user_id") @db.Uuid` — nullable. A anonimização no hard-delete usa:
```sql
UPDATE audit_events SET user_id = NULL, ... 
```
Mas a spec define `user_id → 'anonymous-<sha256[:8]>'` como TEXT. Conflito: campo é UUID (`@db.Uuid`).

**Decisão**: no hard-delete, `audit_events.user_id` é setado para `NULL` (Prisma já suporta nullable). O hash anônimo `anonymous-<sha256[:8]>` é gravado numa coluna nova `anonymized_user_ref TEXT` que a migration 9-2 adiciona. Isso preserva auditabilidade (correlação) sem violar o tipo UUID. Ver §2.1 abaixo.

### 1.5 Frontend: rota de privacidade existente

`/app/consumo/perfil/privacidade/page.tsx` — CSR, já tem `ExportSection`. Story 9-2 adiciona `DeletionSection` no final da mesma página.

Layout autenticado (AppShell) precisa receber o banner de `deletion_pending`. Localização: `apps/web/app/(authenticated)/layout.tsx` ou componente de shell.

### 1.6 Keycloak — revogação de sessão

Não há serviço dedicado de revogação Keycloak no código. Story 2-10 implementou `KeycloakAuthGuard` com override Redis. Revogar sessão = deletar chaves Redis do session cache + chamar Keycloak Admin API `DELETE /sessions/{sessionId}` (se disponível) ou invalidar via `revokeToken`. Implementação prática: deletar todas as chaves Redis `session:{userId}:*` (padrão do guard).

### 1.7 MinIO paths de usuário

Padrão atual: `exports/global/{userId}/{date}-{jobId}.{format}` (Story 9-1). Outros uploads de usuário: path `user/{userId}/...` (citado na spec §3). Confirmar via `StorageService` e migration 8-2 (upload metadata).

---

## 2. Decisões de design

### 2.1 Anonimização `audit_events.user_id` — UUID vs TEXT

**Problema**: `user_id` em `audit_events` é `UUID` (não pode armazenar `'anonymous-...'`).
**Solução**: A migration 9-2 adiciona coluna `anonymized_user_ref TEXT NULL` a `audit_events`.
- No hard-delete: `UPDATE audit_events SET user_id = NULL, anonymized_user_ref = 'anonymous-<hash>' WHERE user_id = :userId`.
- Correlação intra-tenant ainda possível via `anonymized_user_ref`.
- `user_id` fica `NULL` (já é nullable por dec-016).

### 2.2 Tabelas com `onDelete: Cascade` — não precisam soft-delete manual

`participant_radar_status` e `participant_status_improved` têm `onDelete: Cascade` em relação ao `User`. No hard-delete do `users` row, esses registros são removidos automaticamente. Não precisam de método `softDeleteUserData()` — são apenas dados derivados do status do participante.

### 2.3 Soft-delete vs Hard-delete — separação por fases no worker

O `PrivacyDeletionProcessor` implementa **2 jobs distintos** no mesmo worker:
1. `soft-delete-user-data`: executado após `cancellableUntil` — marca `deletedAt` em todas as tabelas.
2. `hard-delete-user-data`: executado após `deletionDeadline` — purge definitivo em transação.

BullMQ `delay` calculado no enfileiramento:
```ts
// Job 1: soft-delete após grace period
await queue.add('soft-delete-user-data', payload, {
  jobId: `soft-${requestId}`,
  delay: cancellableUntil.getTime() - Date.now(),
  attempts: 3,
  backoff: { type: 'custom' },
  ...
});
// Job 2: hard-delete após 30d
await queue.add('hard-delete-user-data', payload, {
  jobId: `hard-${requestId}`,
  delay: deletionDeadline.getTime() - Date.now(),
  attempts: 3,
  backoff: { type: 'custom' },
  ...
});
```

### 2.4 Guardrail de liderança — query

```ts
const activeGroups = await prisma.groupMember.findMany({
  where: { userId, role: 'lider', group: { status: 'active' } },
  select: { group: { select: { id: true, name: true } } },
});
```
Retorna 422 se `activeGroups.length > 0`.

### 2.5 Export 409 quando `deletion_pending` (Q4 dec-012)

Adicionar verificação no `PrivacyExportService.createJob()`:
```ts
const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
if (user?.status === 'deletion_pending') {
  throw new ConflictException('Cannot create export: account deletion pending.');
}
```

### 2.6 Redis cleanup — SCAN + DEL pattern

```ts
let cursor = '0';
do {
  const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `*:${userId}:*`, 'COUNT', 100);
  cursor = nextCursor;
  if (keys.length > 0) await redis.del(...keys);
} while (cursor !== '0');
```
Também deletar `session:{userId}:*` e `cache:privacy:export-job:*` (não contêm userId no key, mas o job pertence ao userId — deletar jobs do userId via DB lookup).

---

## 3. Riscos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| FK constraint quebrada no hard-delete | Rollback + Sentry alert | Transação por tenant; testar com todos os módulos |
| BullMQ `delay` de 7d/30d — job perdido após restart | Dados não deletados | `removeOnComplete: false` para delayed jobs; monitorar via `deletion_requests.status` |
| Race: cancelamento após soft-delete começar | Inconsistência parcial | Worker verifica `status !== 'cancelled'` antes de cada fase |
| `audit_events` tem política RLS sem UPDATE | Anonimização falha | Worker privilegiado usa `prisma.client` diretamente (bypass RLS) |
| OutreachIntent sem FK para users | Orfão não limpo | Usar raw query `UPDATE outreach_intents SET created_by_user_id = NULL WHERE created_by_user_id = :userId` |

---

## 4. Referências

- `apps/api/src/privacy/privacy-export.service.ts` — padrão createJob/processJob
- `apps/api/src/privacy/privacy-export.processor.ts` — skeleton worker
- `apps/api/prisma/migrations/20260619000000_9-1-privacy-export-jobs/migration.sql` — padrão migration
- `apps/api/prisma/schema.prisma` — schema completo (todos os modelos acima verificados)
- `apps/web/app/(authenticated)/app/consumo/perfil/privacidade/page.tsx` — página existente
- LGPD art. 16 (retenção de consentimentos), art. 18 VI (eliminação), art. 18 § 3º (prazo 15 dias = compatível com grace de 7d)
