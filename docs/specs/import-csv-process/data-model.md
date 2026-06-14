# Data Model — Story 10-4 (import-csv-process)

## Persistência

**Sem migration nova** (decisão RECONCILIACAO §10 + spec §BACKUP/IDEMP). O resultado do job vive em:
- Redis (status/progresso do job assíncrono): key `cache:csv-import:job:{jobId}` (espelha padrão `cache:reports:export-job:{jobId}`). **Payload inclui `tenantId`** (tenant binding — finding OWASP MEDIUM #2): GET status compara com `getRequestContext().tenantId`, mismatch → 404.
- MinIO (relatório CSV de resultado): objeto `csv-import-result/{tenantId}/{jobId}.csv`, exposto por signed URL 24h.

Escrita real no banco reusa serviços já testados:
- `User` + `UserTenant` (criação de conta — só para email inédito na plataforma).
- `GroupMember` (vínculo ao grupo).
- `AdminInvite` (Story 4-3, email cross-tenant).
- `AuditEvent` (Story 9-3, `action: 'import'`).

## Mudança de enum (única alteração de schema de tipos)

`packages/types/src/audit/index.ts` — adicionar `'import'` a `AUDIT_ACTIONS`:
```ts
export const AUDIT_ACTIONS = [
  'create','update','delete','login','logout','auth_failure','config_change','export','import',
] as const;
```
→ atualizar snapshot do schema audit (gate Zod silent-breaking).

## Contratos Zod novos — `packages/types/src/onboarding/csv-import-result.ts`

```ts
import { z } from 'zod';
import { CSVRowSchema } from './csv-import';

// Linha enviada ao servidor: subconjunto validável da CSVRow + grupo destino opcional por linha
export const ImportRowInputSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().nullable(),
  papel: z.enum(['participante', 'lider']),
  grupo: z.string().nullable(),     // nome do grupo (coluna "grupo"); null → usa groupId default
  rowIndex: z.number().int().nonnegative(),
});
export type ImportRowInput = z.infer<typeof ImportRowInputSchema>;

export const ImportRequestSchema = z.object({
  defaultGroupId: z.string().uuid(),   // grupo destino padrão (do path :groupId)
  rows: z.array(ImportRowInputSchema).min(1).max(IMPORT_MAX_ROWS), // teto anti-DoS
});
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

export const importActionSchema = z.enum(['created', 'existing', 'invited', 'failed']);
export type ImportAction = z.infer<typeof importActionSchema>;

export const ImportResultLineSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  email: z.string(),
  nome: z.string(),
  groupName: z.string().nullable(),
  action: importActionSchema,
  reason: z.string().nullable(),       // motivo quando action = failed
});
export type ImportResultLine = z.infer<typeof ImportResultLineSchema>;

export const ImportResultSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  imported: z.number().int().nonnegative(),
  existing: z.number().int().nonnegative(),
  invited: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  lines: z.array(ImportResultLineSchema),
  reportUrl: z.string().nullable(),    // signed URL 24h; null enquanto async não conclui
  jobId: z.string().nullable(),        // presente só no modo assíncrono
});
export type ImportResultSummary = z.infer<typeof ImportResultSummarySchema>;

export const importJobStatusSchema = z.enum(['processing', 'completed', 'failed']);
export const ImportJobStatusSchema = z.object({
  jobId: z.string(),
  status: importJobStatusSchema,
  progress: z.number().int().min(0).max(100),
  result: ImportResultSummarySchema.nullable(),  // preenchido quando completed
  failureReason: z.string().nullable(),
});
export type ImportJobStatus = z.infer<typeof ImportJobStatusSchema>;

export const IMPORT_SYNC_THRESHOLD = 100;   // ≤100 → síncrono; >100 → async
export const IMPORT_MAX_ROWS = 5000;        // teto anti-DoS (defesa OWASP)
export const CSV_IMPORT_QUEUE_NAME = 'csv-import';  // SEM ':'
export const CSV_IMPORT_JOB_TTL_SECONDS = 86400;    // 24h
```

Snapshot test: `packages/types/src/onboarding/__tests__/csv-import-result.snapshot.spec.ts` (gate contra breaking changes silenciosos).

## Decisão por linha (máquina de estados FR03)

```
para cada row:
  group = resolveGroup(row.grupo ?? defaultGroupId, tenantId)
  se group inexistente            → action=failed, reason="Grupo '{nome}' não encontrado no tenant"
  senão:
    user = findUserByEmailGlobal(row.email)   // email é @unique GLOBAL
    se user == null                → CREATE: User + UserTenant('participante') + GroupMember(row.papel) → created
    senão se user tem UserTenant neste tenant:
      se já é membro do group      → existing
      senão                        → add GroupMember(row.papel) → created (conta já existe, vínculo novo)  [ver nota]
    senão (user existe em OUTRO tenant, sem UserTenant aqui) → AdminInvite (Story 4-3) → invited
```
Nota: spec FR03 define "já neste tenant → existing (ignorado)". Interpretação canônica: `existing` cobre o caso de já pertencer ao tenant. Se o usuário pertence ao tenant mas não ao grupo destino, ainda é membro do tenant → tratado como `existing` para respeitar a regra "não duplicar / não auto-mexer". (A clarify fixou: já neste tenant → marcado existente.) → **decisão de plano: `existing` quando há UserTenant neste tenant, independente de pertencer ao grupo.**

## FR04 — validação de limite ANTES (rejeição total)

```
novos = count(rows cujo action projetado ∈ {created})   // só os que adicionam membro novo ao grupo default/destino, por grupo
para cada groupId destino afetado:
  plan = planLimits.getPlan(tenantId)
  limit = getLimit(plan,'membersPerGroup')
  se Number.isFinite(limit):
    current = repo.countByGroup(groupId)
    se current + novos_desse_grupo > limit → REJEITA IMPORT INTEIRO (ForbiddenException PlanLimitReached, PT-BR acionável)
```
Sem import parcial. Mensagem indica limite e excesso.
