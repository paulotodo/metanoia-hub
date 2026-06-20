# Backlog de Tasks — Métricas de Plataforma (Super Admin / FR67)

> **Feature:** `metricas-plataforma`
> **Gerado em:** 2026-06-20
> **Pipeline:** feature-00c (create-tasks)
> **Spec autoritativa:** `docs/specs/metricas-plataforma/spec.md` + `checklist.md` + `research.md`
> **Checklist:** 20 requisitos testáveis + 5 decisões auditáveis (D1–D5)

---

## Legenda de Criticidade

- `[crit]` — bloqueador de release (falha = feature não funciona ou viola segurança)
- `[warn]` — importante mas não bloqueia release se adiado
- `[info]` — melhoria de qualidade ou observabilidade

---

## Matriz de Dependências

```
FASE 1 (Migration)
  └─ 1.1 [crit] → base para todas as outras

FASE 2 (Prisma + Tipos)
  2.1 [crit] depende de: 1.1
  2.2 [crit] depende de: (independente — packages/types)

FASE 3 (BullMQ / Job)
  3.1 [crit] depende de: 1.1
  3.2 [crit] depende de: 3.1
  3.3 [warn] depende de: 3.2

FASE 4 (StorageService Hook)
  4.1 [crit] depende de: 1.1, 2.1
  4.2 [crit] depende de: 4.1

FASE 5 (Endpoints Super Admin)
  5.1 [crit] depende de: 2.1, 2.2, 3.1
  5.2 [crit] depende de: 5.1
  5.3 [crit] depende de: 5.1, 5.2

FASE 6 (Testes)
  6.1 [crit] depende de: 1.1
  6.2 [crit] depende de: 4.1, 4.2
  6.3 [crit] depende de: 5.1, 5.2, 5.3
  6.4 [warn] depende de: 2.2
```

---

## Escopo Coberto

- Migration SQL: `tenant_storage_usage` + `mv_platform_metrics` + UNIQUE INDEX + GRANTs
- Model Prisma `TenantStorageUsage`
- Job BullMQ `refresh-platform-views` (FlowProducer — árvore invertida INF-02)
- Hook de storage em `StorageService.upload()` (SEC-03)
- Endpoints `GET /api/v1/admin/platform-metrics/summary` e `/tenants` (SEC-01, SEC-02)
- Zod schemas `PlatformMetricsSummarySchema` + `PlatformMetricsTenantListSchema` + snapshots
- Testes RLS `tenant_storage_usage` (SEC-04), testes 403, sort-injection, churn/netGrowth

## Escopo Excluído

- Decremento de storage em `StorageService.delete()` (FOLLOW-UP — delete não implementado)
- `averageAttendance` / `averageTrailCompletion` (FOLLOW-UP — GAP-02, sem tabela de presença)
- Frontend / UI (story é backend-only)
- Invalidação de cache Redis proativa (cache expira por TTL; invalidação pós-refresh é tarefa do job)

---

## Resumo das Fases

| Fase | Título | Tasks | [crit] | [warn] |
|------|--------|-------|--------|--------|
| 1 | Migration SQL | 1 | 1 | 0 |
| 2 | Prisma + Tipos Zod | 2 | 2 | 0 |
| 3 | BullMQ FlowProducer | 3 | 2 | 1 |
| 4 | StorageService Hook | 2 | 2 | 0 |
| 5 | Endpoints Super Admin | 3 | 3 | 0 |
| 6 | Testes | 4 | 3 | 1 |
| **Total** | | **15** | **13** | **1** |

---

## FASE 1 — Migration SQL

### 1.1 Criar migration SQL: tenant_storage_usage + mv_platform_metrics [crit]

**Arquivo:** `apps/api/prisma/migrations/YYYYMMDD_create_mv_platform_metrics/migration.sql`
*(renomear YYYYMMDD para a data de execução — ex: `20260620`)*

**Contexto:** MIG-01 + MIG-02 + MIG-03 + MIG-04. Base de toda a feature. A migration usa `--create-only` (NÃO aplicar automaticamente — requer validação manual contra o schema real antes do `migrate deploy`).

**Pré-requisito obrigatório antes de criar o arquivo (MIG-01):** confirmar via `\d tenants`, `\d users`, `\d groups`, `\d meetings` no Postgres local que as colunas SQL referenciam colunas reais:
- `tenants.id` (UUID — PK real; **NUNCA `tenants.tenant_id`** — MIG-02 crítico)
- `users.tenant_id`, `users.last_seen_at` (timestamptz — proxy de login)
- `groups.tenant_id`
- `meetings.tenant_id`, `meetings.status` (valores: `'ended'` ou `'realizado'`)
- `tenants.plan` (VarChar — verificar valores enum reais: `'free'`, `'pro'`, `'enterprise'`)
- `tenants.status` (VarChar)

**Conteúdo da migration (SQL canônico — auditado contra research.md + data-model.md):**

```sql
-- ============================================================
-- 13-4: Métricas de Plataforma (FR67)
-- Prisma não modela MVs — SQL bruto; aplicado via migrate deploy.
-- NUNCA aplicar automaticamente — usar --create-only.
-- ============================================================

-- 1. Tabela de uso de storage por tenant (dec-007)
CREATE TABLE tenant_storage_usage (
  tenant_id  UUID         PRIMARY KEY,
  bytes_used BIGINT       NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 1.a RLS closed-by-default (padrão canônico nullif)
ALTER TABLE tenant_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_storage_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_storage_usage
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 1.b GRANTs para o app role
GRANT SELECT, INSERT, UPDATE ON tenant_storage_usage TO metanoia_app;

-- 2. Materialized view cross-tenant (sem RLS — exceção arquitetural justificada)
CREATE MATERIALIZED VIEW mv_platform_metrics AS
WITH tenant_users AS (
  SELECT
    u.tenant_id,
    COUNT(*)                                                          AS total_users,
    COUNT(*) FILTER (
      WHERE u.last_seen_at >= date_trunc('month', now())
    )                                                                 AS active_users_current_month,
    COUNT(*) FILTER (
      WHERE u.last_seen_at >= date_trunc('month', now()) - INTERVAL '1 month'
        AND u.last_seen_at <  date_trunc('month', now())
    )                                                                 AS active_users_prev_month
  FROM users u
  GROUP BY u.tenant_id
),
tenant_groups AS (
  SELECT g.tenant_id, COUNT(*) AS total_groups
  FROM groups g
  GROUP BY g.tenant_id
),
tenant_meetings AS (
  SELECT m.tenant_id,
         COUNT(*) FILTER (WHERE m.status IN ('ended','realizado')) AS meetings_held
  FROM meetings m
  GROUP BY m.tenant_id
)
SELECT
  t.id                                                AS tenant_id,
  t.name                                              AS tenant_name,
  t.status                                            AS tenant_status,
  t.plan                                              AS tenant_plan,
  t.created_at                                        AS tenant_created_at,
  COALESCE(tu.total_users, 0)::int                    AS total_users,
  COALESCE(tu.active_users_current_month, 0)::int     AS active_users,
  COALESCE(tg.total_groups, 0)::int                   AS total_groups,
  COALESCE(tm.meetings_held, 0)::int                  AS meetings_held,
  COALESCE(tsu.bytes_used, 0)::bigint                 AS storage_bytes_used,
  -- flags de atividade para cálculo de churn no service (mês calendário — D1)
  (COALESCE(tu.active_users_current_month, 0) > 0)    AS active_current_month,
  (COALESCE(tu.active_users_prev_month, 0) > 0)       AS active_prev_month,
  now()                                               AS refreshed_at
FROM tenants t
LEFT JOIN tenant_users         tu  ON tu.tenant_id = t.id
LEFT JOIN tenant_groups        tg  ON tg.tenant_id = t.id
LEFT JOIN tenant_meetings      tm  ON tm.tenant_id = t.id
LEFT JOIN tenant_storage_usage tsu ON tsu.tenant_id = t.id;

-- 3. UNIQUE INDEX obrigatório para REFRESH CONCURRENTLY (INF-01)
--    Por-tenant: uma linha por tenant — index em tenant_id.
CREATE UNIQUE INDEX mv_platform_metrics_pk ON mv_platform_metrics (tenant_id);

-- 4. GRANTs (MIG-04)
GRANT SELECT ON mv_platform_metrics TO metanoia_app;
```

**Executar via:**
```bash
pnpm --filter @metanoia/api exec prisma migrate dev --create-only --name create_mv_platform_metrics
# Após criar o arquivo, SUBSTITUIR o conteúdo pelo SQL acima e validar manualmente.
# Só então: pnpm --filter @metanoia/api exec prisma migrate deploy
```

**AC obrigatórios:**
- [ ] `tenant_storage_usage` existe com `tenant_id UUID PRIMARY KEY`, `bytes_used BIGINT NOT NULL DEFAULT 0`, `updated_at TIMESTAMPTZ`
- [ ] RLS ativo (`ENABLE` + `FORCE`) com policy `tenant_isolation` usando `NULLIF(...)::uuid`
- [ ] `mv_platform_metrics` tem 13 colunas: `tenant_id`, `tenant_name`, `tenant_status`, `tenant_plan`, `tenant_created_at`, `total_users`, `active_users`, `total_groups`, `meetings_held`, `storage_bytes_used`, `active_current_month`, `active_prev_month`, `refreshed_at`
- [ ] UNIQUE INDEX `mv_platform_metrics_pk` em `(tenant_id)` criado
- [ ] `GRANT SELECT ON mv_platform_metrics TO metanoia_app`
- [ ] `GRANT SELECT, INSERT, UPDATE ON tenant_storage_usage TO metanoia_app`
- [ ] SQL usa `t.id` como chave dos JOINs (NUNCA `t.tenant_id`) — MIG-02
- [ ] `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics` executa sem erro após populate mínimo

---

## FASE 2 — Prisma + Tipos Zod

### 2.1 Adicionar model TenantStorageUsage ao schema.prisma e regenerar client [crit]

**Arquivo:** `apps/api/prisma/schema.prisma`

**Contexto:** O Prisma não modela a MV, mas precisa do model `TenantStorageUsage` para o hook de upload e o isolation spec. A `TenantStorageUsage` é o único model novo.

**Adicionar ao schema.prisma:**
```prisma
model TenantStorageUsage {
  tenantId  String   @id @map("tenant_id") @db.Uuid
  bytesUsed BigInt   @default(0) @map("bytes_used")
  updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamptz

  @@map("tenant_storage_usage")
}
```

**Regenerar client:**
```bash
pnpm --filter @metanoia/api exec prisma generate
```

**AC obrigatórios:**
- [ ] `TenantStorageUsage` adicionado ao `schema.prisma` com `@@map("tenant_storage_usage")`
- [ ] `tenantId` como `@id` (PK única por tenant — INF-01)
- [ ] `bytesUsed BigInt` com `@default(0)`
- [ ] `pnpm --filter @metanoia/api exec prisma generate` passa sem erro
- [ ] `PrismaClient` exporta `prisma.tenantStorageUsage` como tipo válido

### 2.2 Criar Zod schemas platform-metrics em packages/types + snapshot tests [crit]

**Arquivos a criar:**
- `packages/types/src/reports/platform-metrics.ts`
- `packages/types/src/reports/__tests__/platform-metrics.spec.ts`

**Contexto:** API-01 + checklist spec. Re-exportar em `packages/types/src/reports/index.ts` e `packages/types/src/index.ts`.

**Conteúdo de `platform-metrics.ts`:**
```typescript
import { z } from 'zod';

// Whitelist de campos ordenáveis — sincronizada com SORT_COLUMN_MAP no service (SEC-02)
export const PlatformMetricsTenantsSortFieldSchema = z.enum([
  'tenantName',
  'totalUsers',
  'activeUsers',
  'totalGroups',
  'totalMeetings',
  'storageUsed',
  'createdAt',
]);
export type PlatformMetricsTenantsSortField = z.infer<typeof PlatformMetricsTenantsSortFieldSchema>;

export const PlatformMetricsSummarySchema = z.object({
  totalTenants: z.number().int().nonnegative(),
  activeTenants: z.number().int().nonnegative(),
  totalUsers: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative(),
  totalGroups: z.number().int().nonnegative(),
  totalMeetings: z.number().int().nonnegative(),
  totalTrails: z.number().int().nonnegative(),
  averageAttendance: z.number().min(0).max(100),
  averageTrailCompletion: z.number().min(0).max(100),
  storageUsed: z.number().int().nonnegative(),     // bytes (BigInt → number no DTO)
  churnedTenants: z.number().int().nonnegative(),
  netGrowth: z.number().int(),                      // pode ser negativo
});
export type PlatformMetricsSummary = z.infer<typeof PlatformMetricsSummarySchema>;

export const PlatformMetricsSummaryResponseSchema = z.object({
  data: PlatformMetricsSummarySchema,
  meta: z.object({
    generatedAt: z.string().datetime(),
    cacheTTL: z.literal(300),
  }),
});

export const PlatformMetricsTenantItemSchema = z.object({
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  plan: z.string(),                                  // sem enum hardcoded — valores do DB
  status: z.string(),
  activeUsers: z.number().int().nonnegative(),
  totalGroups: z.number().int().nonnegative(),
  totalMeetings: z.number().int().nonnegative(),
  storageUsed: z.number().int().nonnegative(),       // bytes
  createdAt: z.string().datetime(),
});
export type PlatformMetricsTenantItem = z.infer<typeof PlatformMetricsTenantItemSchema>;

export const PlatformMetricsTenantListResponseSchema = z.object({
  data: z.array(PlatformMetricsTenantItemSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export type PlatformMetricsTenantListResponse = z.infer<typeof PlatformMetricsTenantListResponseSchema>;
```

**Conteúdo de `platform-metrics.spec.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import {
  PlatformMetricsSummaryResponseSchema,
  PlatformMetricsTenantListResponseSchema,
} from '../platform-metrics';

const mockSummary = {
  data: {
    totalTenants: 42, activeTenants: 35, totalUsers: 1200, activeUsers: 800,
    totalGroups: 300, totalMeetings: 500, totalTrails: 0,
    averageAttendance: 0, averageTrailCompletion: 0,
    storageUsed: 104857600, churnedTenants: 2, netGrowth: 5,
  },
  meta: { generatedAt: new Date().toISOString(), cacheTTL: 300 as const },
};

const mockTenantList = {
  data: [{
    tenantId: '00000000-0000-7000-8000-000000000001',
    tenantName: 'Igreja Exemplo', plan: 'pro', status: 'active',
    activeUsers: 50, totalGroups: 10, totalMeetings: 20,
    storageUsed: 1048576, createdAt: new Date().toISOString(),
  }],
  meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

describe('PlatformMetricsSummaryResponseSchema', () => {
  it('parse válido — snapshot', () => {
    expect(PlatformMetricsSummaryResponseSchema.parse(mockSummary)).toMatchSnapshot();
  });
  it('rejeita netGrowth ausente', () => {
    const bad = { ...mockSummary, data: { ...mockSummary.data, netGrowth: undefined } };
    expect(() => PlatformMetricsSummaryResponseSchema.parse(bad)).toThrow();
  });
  it('rejeita cacheTTL diferente de 300', () => {
    const bad = { ...mockSummary, meta: { ...mockSummary.meta, cacheTTL: 60 } };
    expect(() => PlatformMetricsSummaryResponseSchema.parse(bad)).toThrow();
  });
});

describe('PlatformMetricsTenantListResponseSchema', () => {
  it('parse válido — snapshot', () => {
    expect(PlatformMetricsTenantListResponseSchema.parse(mockTenantList)).toMatchSnapshot();
  });
  it('rejeita tenantId inválido (não UUID)', () => {
    const bad = { ...mockTenantList, data: [{ ...mockTenantList.data[0], tenantId: 'not-a-uuid' }] };
    expect(() => PlatformMetricsTenantListResponseSchema.parse(bad)).toThrow();
  });
});
```

**Atualizar re-exports:**
- `packages/types/src/reports/index.ts`: adicionar `export * from './platform-metrics';`
- `packages/types/src/index.ts`: verificar se `reports/index.ts` já é re-exportado; se não, adicionar.

**AC obrigatórios:**
- [ ] `packages/types/src/reports/platform-metrics.ts` criado com todos os schemas
- [ ] `PlatformMetricsTenantsSortFieldSchema` enum exportado (sync com SORT_COLUMN_MAP)
- [ ] `packages/types/src/reports/__tests__/platform-metrics.spec.ts` criado
- [ ] Snapshot gerado automaticamente no primeiro `pnpm test` em packages/types
- [ ] `packages/types/src/reports/index.ts` re-exporta `platform-metrics`
- [ ] `packages/types/src/index.ts` re-exporta reports

---

## FASE 3 — BullMQ FlowProducer (Job refresh-platform-views)

### 3.1 Adicionar createFlowProducer() ao BullMqService e migrar scheduler [crit]

**Arquivos a modificar:**
- `apps/api/src/reports/bullmq.service.ts` (adicionar `createFlowProducer()`)
- `apps/api/src/reports/reports.module.ts` (registrar worker do novo processor)

**Arquivos a criar:**
- `apps/api/src/reports/jobs/refresh-platform-views.processor.ts`

**Contexto:** INF-02 (árvore invertida — D3, score 3). Semântica BullMQ: children executam ANTES do parent. Para "platform-refresh APÓS tenant-refresh", a árvore é invertida: `refresh-platform-views` = PARENT, `refresh-tenant-views` = CHILD.

**Modificação em `bullmq.service.ts` — adicionar método:**
```typescript
// NOTA: árvore invertida — "parent" aqui é o job que executa POR ÚLTIMO (platform-refresh),
// e "child" é o job que executa PRIMEIRO (tenant-refresh).
// Isso respeita a semântica BullMQ onde children rodam antes do parent.
createFlowProducer(): FlowProducer {
  return new FlowProducer({ connection: this.getConnectionOptions() });
}
```

**Substituir o `queue.add('refresh-tenant-views', ...)` existente no scheduler por:**
```typescript
const flow = this.bullMqService.createFlowProducer();
await flow.add({
  name: 'refresh-platform-views',          // PARENT — executa APÓS o child
  queueName: REPORTS_QUEUE_NAME,
  data: {},
  children: [
    {
      name: 'refresh-tenant-views',          // CHILD — executa PRIMEIRO
      queueName: REPORTS_QUEUE_NAME,
      data: {},
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        failParentOnFailure: false,          // falha do tenant NÃO bloqueia platform (dec-008)
      },
    },
  ],
  opts: {
    jobId: 'refresh-platform-views-scheduler',
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
});
await flow.close();
```

**Criar `refresh-platform-views.processor.ts`:**
```typescript
// apps/api/src/reports/jobs/refresh-platform-views.processor.ts
// Child job do FlowProducer — executa APÓS refresh-tenant-views completar.
// Usa privileged client (superuser) para REFRESH CONCURRENTLY cross-tenant.
```
- Replicar padrão de `refresh-tenant-views.processor.ts`: `createPrivilegedClient()` (INF-03), `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics` FORA de `$transaction`
- `await privileged.$disconnect()` no `finally`
- Gravar em `mv_refresh_log` com `mvName: 'mv_platform_metrics'`, `tenantId: null`, `status`, `durationMs`
- Invalidar cache Redis `cache:platform-metrics:summary` após refresh bem-sucedido (FR67-09)

**Registrar o worker em `reports.module.ts`:**
- Adicionar `RefreshPlatformViewsProcessor` ao providers

**AC obrigatórios:**
- [ ] `BullMqService.createFlowProducer()` retorna `FlowProducer` com mesma connection config de `createQueue`
- [ ] Scheduler usa `flow.add()` com `refresh-platform-views` como PARENT e `refresh-tenant-views` como CHILD
- [ ] Comentário obrigatório "NOTA: árvore invertida..." presente no código do flow
- [ ] `failParentOnFailure: false` no child (INF-05)
- [ ] `refresh-platform-views.processor.ts` existe e usa `createPrivilegedClient()` (INF-03)
- [ ] REFRESH CONCURRENTLY fora de `$transaction`
- [ ] `$disconnect()` no finally
- [ ] Cache Redis `cache:platform-metrics:summary` invalidado após refresh
- [ ] `RefreshPlatformViewsProcessor` registrado no `ReportsModule`

### 3.2 Implementar alerta mv_platform_refresh_slow (>5min) [crit]

**Arquivo:** `apps/api/src/reports/jobs/refresh-platform-views.processor.ts`

**Contexto:** INF-04. O refresh da MV plataforma pode ser lento em produção (muitos tenants). Se `durationMs > 300_000` (5min), emitir log de alerta estruturado.

**Implementação:**
```typescript
const durationMs = Date.now() - startAt;
if (durationMs > 300_000) {
  this.logger.warn('mv_platform_refresh_slow', {
    mvName: 'mv_platform_metrics',
    durationMs,
    threshold: 300_000,
  });
}
```

**AC obrigatórios:**
- [ ] `logger.warn('mv_platform_refresh_slow', { mvName, durationMs, threshold })` ao ultrapassar 5min
- [ ] Log estruturado (objeto, não string interpolada)
- [ ] Alerta é independente do sucesso/falha do REFRESH (sempre verificado no finally)

### 3.3 Escrever spec unitária do refresh-platform-views.processor [warn]

**Arquivo:** `apps/api/src/reports/jobs/refresh-platform-views.processor.spec.ts`

**Contexto:** Paridade com `refresh-tenant-views.processor.spec.ts`.

**Cenários mínimos:**
```typescript
// refresh-platform-views.processor.spec.ts
it('executa REFRESH CONCURRENTLY mv_platform_metrics via privileged client', ...)
it('invalida cache Redis cache:platform-metrics:summary após refresh', ...)
it('loga mv_platform_refresh_slow quando durationMs > 300000', ...)
it('chama privileged.$disconnect() no finally mesmo em erro', ...)
it('FlowProducer: tenant-child completa antes de platform-parent iniciar', ...)
```

**AC obrigatórios:**
- [ ] Spec criada com mocks de `PrismaService.createPrivilegedClient()` e `RedisService`
- [ ] Todos os 5 cenários cobertos
- [ ] `pnpm --filter @metanoia/api test` passa

---

## FASE 4 — StorageService Hook

### 4.1 Adicionar hook de UPSERT em StorageService.upload() [crit]

**Arquivo:** `apps/api/src/storage/storage.service.ts`

**Contexto:** SEC-03 + dec-007 + CLARIFY-02. Adição limpa (sem UPSERT atual).
`StorageModule` deve importar `PrismaModule` para injetar `PrismaService`.

**Modificações:**

1. Injetar `PrismaService` no constructor do `StorageService`
2. Importar `PrismaModule` em `StorageModule`
3. Adicionar hook ao final do método `upload()`:

```typescript
async upload(objectKey: string, buffer: Buffer, mimeType: string): Promise<string> {
  await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
    'Content-Type': mimeType,
  });

  // SEC-03: incrementar bytes_used no contexto de tenant corrente.
  // Guard: sem tenant context (jobs/seeds) → warn e pular (não falhar o upload).
  const tenantId = RequestContext.getTenantId();  // via AsyncLocalStorage
  if (!tenantId) {
    this.logger.warn('storage-hook: skipping upsert, no tenant context');
  } else {
    await this.prisma.$executeRaw`
      INSERT INTO tenant_storage_usage (tenant_id, bytes_used, updated_at)
      VALUES (${tenantId}::uuid, ${buffer.length}, now())
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        bytes_used = tenant_storage_usage.bytes_used + ${buffer.length},
        updated_at = now()
    `;
  }

  return objectKey;
}
```

**Nota:** Usar `$executeRaw` com template literal (previne SQL injection). Não usar `withTenantTx` aqui — a extensão Prisma multi-tenant injeta o GUC automaticamente quando `tenantId` está no contexto; `$executeRaw` é necessário pois `TenantStorageUsage` não tem um upsert Prisma nativo com `ON CONFLICT DO UPDATE SET bytes_used += ...`.

**AC obrigatórios:**
- [ ] `PrismaModule` importado em `StorageModule`
- [ ] `PrismaService` injetado em `StorageService` via constructor
- [ ] `RequestContext.getTenantId()` verificado antes do UPSERT
- [ ] Se `null`: `logger.warn('storage-hook: skipping upsert, no tenant context')` + return objectKey (upload não falha)
- [ ] Se presente: `$executeRaw` com `INSERT ... ON CONFLICT DO UPDATE SET bytes_used += buffer.length`
- [ ] Upload para MinIO ocorre ANTES do UPSERT (falha de UPSERT não reverte o upload — comportamento intencional para MVP)
- [ ] Decremento no `delete()` marcado como TODO/follow-up em comentário

### 4.2 Atualizar storage.service.spec.ts com cenários do hook [crit]

**Arquivo:** `apps/api/src/storage/storage.service.spec.ts`

**Contexto:** SEC-03 testes obrigatórios.

**Adicionar ao spec existente:**
```typescript
describe('upload() — storage hook SEC-03', () => {
  it('sem tenantId: não lança, não chama $executeRaw, loga warn', async () => {
    // arrange: RequestContext sem tenant_id (spy retorna null)
    // act: await storageService.upload('key', Buffer.alloc(1024), 'image/png')
    // assert: minio.putObject chamado 1x; prisma.$executeRaw NOT called; logger.warn chamado
  });

  it('com tenantId válido: UPSERT incrementa bytes_used corretamente', async () => {
    // arrange: RequestContext.getTenantId() retorna uuid válido
    // act: upload buffer de 1024 bytes
    // assert: prisma.$executeRaw chamado com INSERT ... bytes=1024 ON CONFLICT DO UPDATE
  });

  it('falha no UPSERT não reverte putObject (já feito)', async () => {
    // arrange: $executeRaw lança; MinIO.putObject já executado
    // assert: erro do UPSERT propaga (ou é tratado graciosamente — documentar comportamento)
  });
});
```

**AC obrigatórios:**
- [ ] Todos os 3 cenários implementados
- [ ] Mocks de `RequestContext.getTenantId()` e `PrismaService.$executeRaw`
- [ ] `pnpm --filter @metanoia/api test` passa para o storage.service.spec.ts

---

## FASE 5 — Endpoints Super Admin

### 5.1 Criar PlatformMetricsService com queries $queryRaw sobre mv_platform_metrics [crit]

**Arquivo:** `apps/api/src/super-admin/platform-metrics.service.ts`

**Contexto:** FR67-04 + FR67-05 + API-02 + API-03 + API-04 (churn via `last_seen_at`).

**Métodos obrigatórios:**

**`getSummary()`** — lê MV via `$queryRaw` + calcula agregados:
```typescript
// Query sobre a MV (snake_case → mapeado para camelCase no service)
const rows = await this.prisma.$queryRaw<MvRow[]>`
  SELECT
    COUNT(*)::int                                              AS total_tenants,
    COALESCE(SUM(total_users), 0)::int                         AS total_users,
    COALESCE(SUM(active_users), 0)::int                        AS active_users,
    COALESCE(SUM(total_groups), 0)::int                        AS total_groups,
    COALESCE(SUM(meetings_held), 0)::int                       AS meetings_held,
    COALESCE(SUM(storage_bytes_used), 0)::bigint               AS storage_bytes_used,
    COUNT(*) FILTER (WHERE active_prev_month AND NOT active_current_month)::int AS churned_tenants,
    COUNT(*) FILTER (WHERE tenant_created_at >= date_trunc('month', now()))::int AS new_tenants
  FROM mv_platform_metrics
`;
// netGrowth = new_tenants - churned_tenants  (calculado em TS — D1)
```

**`getTenants(page, limit, sortBy, sortOrder, planFilter, statusFilter)`** — paginação + sort seguro:
```typescript
// SORT_COLUMN_MAP: whitelist anti-injection (SEC-02)
const SORT_COLUMN_MAP: Record<PlatformMetricsTenantsSortField, string> = {
  tenantName:    'tenant_name',
  totalUsers:    'total_users',
  activeUsers:   'active_users',
  totalGroups:   'total_groups',
  totalMeetings: 'meetings_held',
  storageUsed:   'storage_bytes_used',
  createdAt:     'tenant_created_at',
};
// Usar SOMENTE valores do SORT_COLUMN_MAP no ORDER BY — nunca interpolação direta de input
```

**Cache Redis para `getSummary()`:**
- Key: `cache:platform-metrics:summary`
- TTL: 300s (5min)
- Se hit: retornar diretamente sem query
- Invalidado pelo `refresh-platform-views.processor.ts` (FASE 3)

**Resultado BigInt:** converter `storage_bytes_used` de `BigInt` para `number` antes de retornar DTO.

**AC obrigatórios:**
- [ ] `PlatformMetricsService` criado em `apps/api/src/super-admin/`
- [ ] `getSummary()` usa `$queryRaw` sobre `mv_platform_metrics` com agregados corretos
- [ ] `netGrowth = newTenants - churnedTenants` calculado em TS (D1)
- [ ] Cache Redis `cache:platform-metrics:summary` TTL 300s (API-02)
- [ ] `getTenants()` usa `SORT_COLUMN_MAP` whitelist para ORDER BY (SEC-02)
- [ ] Filtro por `plan` e `status` via parâmetros Zod validados (SEC-02)
- [ ] `storage_bytes_used` BigInt → number antes do DTO
- [ ] `totalTrails: 0` como placeholder explícito com TODO comment (GAP-02)
- [ ] `averageAttendance: 0` e `averageTrailCompletion: 0` com TODO comment (GAP-02)

### 5.2 Criar PlatformMetricsController com guards SUPER_ADMIN [crit]

**Arquivo:** `apps/api/src/super-admin/platform-metrics.controller.ts`

**Contexto:** SEC-01 (authZ duplo guard) + API-01 (envelope canônico).

**Implementação:**
```typescript
@Controller('admin/platform-metrics')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('super_admin')                        // SEC-01: guard em nível de classe
export class PlatformMetricsController {

  @Get('summary')
  async getSummary(): Promise<PlatformMetricsSummaryResponseSchema> {
    const data = await this.platformMetricsService.getSummary();
    return {
      data,
      meta: { generatedAt: new Date().toISOString(), cacheTTL: 300 },
    };
  }

  @Get('tenants')
  async getTenants(@Query() query: PlatformTenantsQueryDto): Promise<PlatformMetricsTenantListResponse> {
    const { data, total } = await this.platformMetricsService.getTenants(
      query.page ?? 1, query.limit ?? 20,
      query.sortBy ?? 'tenantName', query.sortOrder ?? 'asc',
      query.plan, query.status,
    );
    return {
      data,
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        totalPages: Math.ceil(total / (query.limit ?? 20)),
      },
    };
  }
}
```

**Query DTO `PlatformTenantsQueryDto`:**
```typescript
// Zod: page (int>0 default 1), limit (int 1–100 default 20),
//      sortBy (PlatformMetricsTenantsSortFieldSchema default 'tenantName'),
//      sortOrder (enum asc|desc default 'asc'),
//      plan (string opcional), status (string opcional)
```

**AC obrigatórios:**
- [ ] `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles('super_admin')` em nível de classe
- [ ] `GET /api/v1/admin/platform-metrics/summary` retorna envelope `{data, meta:{generatedAt, cacheTTL:300}}`
- [ ] `GET /api/v1/admin/platform-metrics/tenants` retorna envelope `{data[], meta:{total,page,limit,totalPages}}`
- [ ] `PlatformTenantsQueryDto` validado via `ZodValidationPipe` (não third-party — CLAUDE.md)
- [ ] `sortBy` validado contra `PlatformMetricsTenantsSortFieldSchema` (SEC-02)
- [ ] Rota registrada com prefixo `/api/v1/` (CLAUDE.md)

### 5.3 Estender SuperAdminTenantsModule para incluir PlatformMetricsController [crit]

**Arquivo:** `apps/api/src/super-admin/super-admin-tenants.module.ts`

**Contexto:** Módulo existente — estender sem quebrar funcionalidade atual.

**Modificações:**
```typescript
@Module({
  imports: [PrismaModule, RedisModule /* ou CacheModule */],
  controllers: [
    SuperAdminTenantsController,
    PlatformMetricsController,          // adicionar
  ],
  providers: [
    SuperAdminTenantsService,
    SuperAdminTenantsRepository,
    PlatformMetricsService,             // adicionar
  ],
})
export class SuperAdminTenantsModule {}
```

**AC obrigatórios:**
- [ ] `PlatformMetricsController` adicionado ao `controllers` do módulo
- [ ] `PlatformMetricsService` adicionado ao `providers`
- [ ] `PrismaModule` e `RedisModule` (ou equivalente de cache) importados
- [ ] `pnpm --filter @metanoia/api build` passa sem erro TypeScript

---

## FASE 6 — Testes

### 6.1 Criar RLS isolation spec: tenant-storage-usage.rls-spec.ts [crit]

**Arquivo:** `apps/api/test/rls/tenant-storage-usage.rls-spec.ts`

**Contexto:** SEC-04. Padrão idêntico aos specs RLS existentes (`audit-events.rls-spec.ts`). IDEMPOTENTE: usar `generateId()` para emails/slugs e tenant IDs únicos por run. Roda 2x no CI.

**Estrutura obrigatória:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';

// IDs únicos por run — idempotência em CI (roda 2x)
const TENANT_A_ID = generateId();
const TENANT_B_ID = generateId();

// Cenários:
describe('tenant_storage_usage — RLS isolation (SEC-04)', () => {
  it('tenant A não lê row de tenant B (via app role)', async () => {
    // arrange: INSERT row de B com SET LOCAL app.current_tenant_id=B
    // act: SET LOCAL app.current_tenant_id=A; SELECT * FROM tenant_storage_usage
    // assert: 0 rows retornados
  });

  it('INSERT com tenant_id de B viola RLS quando context=A', async () => {
    // act: SET LOCAL app.current_tenant_id=A; INSERT (tenant_id=B, bytes=100)
    // assert: lança erro (violação de policy RLS WITH CHECK)
  });

  it('privileged client (superuser) lê todos os rows cross-tenant', async () => {
    // arrange: rows de A e B no banco
    // act: query via DATABASE_URL (superuser, sem SET LOCAL)
    // assert: vê ambas as rows
  });

  it('SELECT sem tenant context retorna 0 rows (NULLIF garante)', async () => {
    // act: RESET app.current_tenant_id; SELECT * FROM tenant_storage_usage
    // assert: 0 rows (não lança — NULLIF converte '' em NULL, policy = false)
  });
});
```

**Requisitos de seed (padrão do projeto):**
- `INSERT INTO tenants` com `id = TENANT_X_ID`, `tenant_id = TENANT_X_ID`, `name = 'Test...'`, enums em PT, `created_at`, `updated_at`
- Todos os seeds via `ON CONFLICT DO NOTHING` (idempotência)
- `DATABASE_APP_URL` para app role; `DATABASE_URL` para superuser

**AC obrigatórios:**
- [ ] Arquivo criado em `apps/api/test/rls/tenant-storage-usage.rls-spec.ts`
- [ ] Usa `generateId()` para todos os IDs (idempotência)
- [ ] 4 cenários implementados (leitura cross-tenant, INSERT violação, superuser, sem context)
- [ ] `pnpm --filter @metanoia/api test` passa (rodando 2x não acumula rows espúrios)

### 6.2 Testes de segurança: 403 não-super-admin + sort-injection [crit]

**Arquivo:** `apps/api/src/super-admin/platform-metrics.controller.spec.ts`

**Contexto:** SEC-01 (403) + SEC-02 (sort-injection → 400).

**Cenários obrigatórios:**
```typescript
describe('PlatformMetricsController — security', () => {
  describe('SEC-01: AuthZ', () => {
    it('GET /summary retorna 403 para usuário sem role super_admin', async () => {
      // arrange: token sem 'super_admin' no roles claim
      // assert: 403 Forbidden
    });
    it('GET /tenants retorna 403 para usuário sem role super_admin', async () => { ... });
    it('GET /summary retorna 403 para request sem autenticação', async () => { ... });
  });

  describe('SEC-02: sort injection', () => {
    it('sortBy com valor fora da whitelist retorna 400', async () => {
      // act: GET /tenants?sortBy='; DROP TABLE tenants; --
      // assert: 400 (ZodValidationPipe rejeita antes de chegar ao service)
    });
    it('sortBy válido (tenantName) funciona normalmente', async () => { ... });
  });
});
```

**AC obrigatórios:**
- [ ] Spec criada em `apps/api/src/super-admin/platform-metrics.controller.spec.ts`
- [ ] 403 para não-super-admin em ambos os endpoints (SEC-01)
- [ ] 403 para request sem auth
- [ ] 400 para `sortBy` fora da whitelist `PlatformMetricsTenantsSortFieldSchema` (SEC-02)
- [ ] `pnpm --filter @metanoia/api test` passa

### 6.3 Testes de integração: churn/netGrowth + cache + paginação [crit]

**Arquivo:** `apps/api/src/super-admin/platform-metrics.service.spec.ts`

**Contexto:** API-04 (churn via `last_seen_at`) + API-02 (cache) + API-03 (paginação).

**Cenários obrigatórios:**
```typescript
describe('PlatformMetricsService', () => {
  describe('getSummary()', () => {
    it('churnedTenants: conta apenas tenants ativos no mês anterior e inativos no corrente', () => {
      // arrange: mock da MV com rows: 2 ativos prev+não-current, 1 ativo ambos, 1 novo
      // assert: churnedTenants=2, netGrowth=newTenants-2
    });
    it('netGrowth = newTenants - churnedTenants (pode ser negativo)', () => { ... });
    it('retorna do cache Redis se hit (sem $queryRaw)', () => {
      // arrange: RedisService retorna JSON válido
      // assert: prisma.$queryRaw NOT called
    });
    it('popula cache Redis com TTL 300 após miss', () => { ... });
  });

  describe('getTenants()', () => {
    it('meta.totalPages = Math.ceil(total / limit)', () => { ... });
    it('sortBy mapeia para coluna SQL via SORT_COLUMN_MAP (não interpolação direta)', () => { ... });
    it('filtro por plan retorna apenas tenants daquele plan', () => { ... });
  });
});
```

**AC obrigatórios:**
- [ ] Spec criada com mocks de `PrismaService` e `RedisService`
- [ ] Lógica de churn/netGrowth testada com dados de atividade por mês calendário
- [ ] Cache hit/miss testado
- [ ] Paginação e `totalPages` testados
- [ ] `pnpm --filter @metanoia/api test` passa

### 6.4 Snapshot Zod: gerar e comitar arquivo .snap [warn]

**Arquivo:** `packages/types/src/reports/__tests__/__snapshots__/platform-metrics.spec.ts.snap`

**Contexto:** Gate contra mudanças silenciosas nos contratos (CLAUDE.md — snapshot tests obrigatórios para Zod schemas).

**Procedimento:**
```bash
cd /var/lib/metanoia-hub
pnpm --filter @metanoia/types test -- --update-snapshots
# Verificar o arquivo .snap gerado e commitar junto com o código.
```

**AC obrigatórios:**
- [ ] Arquivo `.snap` gerado após rodar os testes de `platform-metrics.spec.ts`
- [ ] Arquivo commitado no repositório (não em `.gitignore`)
- [ ] CI valida que o snapshot não regrediu (não requer `--update-snapshots` no CI)

---

## Validações Pós-Implementação (execute-task gate)

Antes de fechar execute-task, executar manualmente:

```bash
# 1. Verificar colunas da MV no Postgres local
docker compose exec postgres psql -U metanoia -d metanoia_dev \
  -c "\d mv_platform_metrics" \
  -c "\d tenant_storage_usage"

# 2. Verificar RLS ativo
docker compose exec postgres psql -U metanoia -d metanoia_dev \
  -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='tenant_storage_usage'"

# 3. Verificar UNIQUE INDEX
docker compose exec postgres psql -U metanoia -d metanoia_dev \
  -c "\di mv_platform_metrics_pk"

# 4. REFRESH CONCURRENTLY manual
docker compose exec postgres psql -U metanoia -d metanoia_dev \
  -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics"

# 5. Suite completa
pnpm --filter @metanoia/api test
pnpm --filter @metanoia/types test
```

