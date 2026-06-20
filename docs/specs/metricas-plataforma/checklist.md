# Checklist de Qualidade — Métricas de Plataforma (FR67)

> **Fase:** checklist (pós-plan, pré-create-tasks)
> **Gerado em:** 2026-06-20
> **Objetivo:** converter "riscos documentados" em "requisitos testáveis" antes da implementação

---

## Status Geral

| Categoria | Itens | Alertas Críticos | Gaps Significativos |
|-----------|-------|-----------------|---------------------|
| Segurança | 4 | 0 | 0 |
| Infra / Observabilidade | 5 | 0 | 0 |
| API | 4 | 0 | 0 |
| Migration | 4 | 1 | 0 |
| Gaps da Spec | 3 | 0 | 1 |
| **Total** | **20** | **1** | **1** |

**Decisões resolvidas nesta fase:** 5 (D1–D5)

---

## Segurança

### SEC-01 — AuthZ duplo guard (KeycloakAuthGuard + RolesGuard)

**Status:** REQUISITO TESTÁVEL

**Contexto:** A spec identificou risco de "single-barrier" na autenticação. O padrão existente em `super-admin-tenants.controller.ts` usa `@UseGuards(KeycloakAuthGuard, RolesGuard)` — DUPLO guard correto. O `RolesGuard` tem lógica de bypass para `SUPER_ADMIN` (correto: super_admin passa em todos os guards de role). O novo controller deve seguir o mesmo padrão.

**Requisito:**
- `platform-metrics.controller.ts` DEVE ter `@UseGuards(KeycloakAuthGuard, RolesGuard)` e `@Roles(Role.SUPER_ADMIN)` em nível de **classe** (não apenas em métodos individuais).
- `KeycloakAuthGuard` valida e decodifica o JWT; popula `request.user` com `roles: string[]`.
- `RolesGuard` verifica `user.roles.includes(Role.SUPER_ADMIN)`.

**Teste obrigatório:**
```typescript
// platform-metrics.controller.spec.ts
it('retorna 403 para role tenant_admin', async () => {
  // arrange: JWT com role = 'tenant_admin', sem 'super_admin'
  // act: GET /api/v1/admin/platform-metrics/summary
  // assert: expect(response.status).toBe(403)
});

it('retorna 200 para role super_admin', async () => {
  // arrange: JWT com role = 'super_admin'
  // act: GET /api/v1/admin/platform-metrics/summary
  // assert: expect(response.status).toBe(200)
});
```

---

### SEC-02 — sortBy whitelist anti-SQL-injection

**Status:** REQUISITO TESTÁVEL

**Contexto:** O parâmetro `sortBy` controla cláusula ORDER BY em `$queryRaw`. Interpolar `sortBy` bruto no SQL abre SQL injection. Já documentado no contracts/, mas o requisito de mapeamento explícito coluna→campo estava implícito.

**Requisito:**
- `PlatformMetricsTenantsSortFieldSchema` (em `packages/types`) DEVE ser enum fechado com exatamente estes 7 valores:
  ```
  tenantName | totalUsers | activeUsers | totalGroups | meetingsHeld | storageBytesUsed | tenantCreatedAt
  ```
- No service, declarar `const SORT_COLUMN_MAP: Record<string, string>` mapeando enum → coluna SQL:
  ```typescript
  const SORT_COLUMN_MAP = {
    tenantName: 'tenant_name',
    totalUsers: 'total_users',
    activeUsers: 'active_users',
    totalGroups: 'total_groups',
    meetingsHeld: 'meetings_held',
    storageBytesUsed: 'storage_bytes_used',
    tenantCreatedAt: 'tenant_created_at',
  } as const;
  ```
- Usar `Prisma.sql` com o valor mapeado (nunca `sortBy` bruto): `Prisma.sql([SORT_COLUMN_MAP[sortBy]])`.
- `sortDir` DEVE ser restrito a `'asc' | 'desc'` via Zod antes de entrar no SQL.

**Teste obrigatório:**
```typescript
it('retorna 400 para sortBy inválido', async () => {
  // GET /api/v1/admin/platform-metrics/tenants?sortBy=injected;DROP TABLE tenants;--
  // expect(response.status).toBe(400)
  // expect(response.body.error).toBe('Bad Request')
});

it('mapeia sortBy=totalUsers para coluna total_users', () => {
  // unit: SORT_COLUMN_MAP['totalUsers'] === 'total_users'
  // unit: service gera SQL com 'ORDER BY total_users DESC' para sortBy=totalUsers&sortDir=desc
});
```

---

### SEC-03 — StorageService hook guard-tenant

**Status:** REQUISITO TESTÁVEL

**Contexto:** O `StorageService.upload()` atual (confirmado via leitura do arquivo real) não tem nenhum UPSERT de storage — é adição limpa. O risco é que `upload()` pode ser chamado fora de request context (jobs/seeds), onde `RequestContext.getTenantId()` retorna `null`, causando violação de PK no INSERT.

**Requisito:**
- No início do bloco de UPSERT dentro de `upload()`, verificar:
  ```typescript
  const tenantId = RequestContext.getTenantId(); // via AsyncLocalStorage
  if (!tenantId) {
    this.logger.warn('storage-hook: skipping upsert, no tenant context');
    return objectKey; // retorna normalmente sem fazer UPSERT
  }
  ```
- O upload para MinIO DEVE ocorrer normalmente mesmo sem tenant context.
- O UPSERT em `tenant_storage_usage` DEVE ser pulado (não falhar) quando sem context.

**Teste obrigatório:**
```typescript
// storage.service.spec.ts
it('upload sem tenantId: não lança, não faz UPSERT, loga warn', async () => {
  // arrange: RequestContext sem tenant_id
  // act: await storageService.upload('key', buffer, 'image/png')
  // assert: MinIO.putObject chamado 1x; prisma.$executeRaw NOT called; logger.warn chamado
});

it('upload com tenantId válido: UPSERT incrementa bytes_used', async () => {
  // arrange: RequestContext com tenantId = uuid
  // act: upload buffer de 1024 bytes
  // assert: prisma.$executeRaw chamado com INSERT ... bytes=1024 ON CONFLICT DO UPDATE
});
```

---

### SEC-04 — RLS isolation tenant_storage_usage

**Status:** REQUISITO TESTÁVEL

**Contexto:** `tenant_storage_usage` tem RLS via policy `tenant_isolation` (padrão canônico `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`). A MV `mv_platform_metrics` é cross-tenant e lida via privileged client — sem RLS por design.

**Requisito:**
- Arquivo de teste RLS OBRIGATÓRIO: `apps/api/test/rls/tenant-storage-usage.rls-spec.ts`.
- Cenários mínimos:
  - Tenant A NÃO lê rows de Tenant B via app role.
  - Tenant A NÃO insere rows com `tenant_id` de Tenant B.
  - Privileged client (superuser) lê todos os rows (para a MV).

**Teste obrigatório:**
```typescript
// tenant-storage-usage.rls-spec.ts
it('tenant A não vê storage de tenant B', async () => {
  // arrange: row de tenant B no banco
  // act: SET app.current_tenant_id=A; SELECT * FROM tenant_storage_usage
  // assert: resultado vazio (0 rows) para tenant B
});

it('INSERT com tenant_id errado viola RLS', async () => {
  // act: SET app.current_tenant_id=A; INSERT (tenant_id=B, bytes=100)
  // assert: lança violação de policy RLS
});
```

---

## Infra / Observabilidade

### INF-01 — UNIQUE INDEX por-tenant (divergência singleton resolvida)

**Status:** DIVERGÊNCIA RESOLVIDA

**Contexto:** A `spec.md` ainda referencia UNIQUE INDEX sobre expressão constante `((1))` (abordagem singleton de 1 linha). O `research.md` (dec-001) decidiu por MV com granularidade **por tenant** (uma linha por tenant), onde o UNIQUE INDEX deve ser sobre `tenant_id`.

**Decisão (dec-001):** MV por-tenant. UNIQUE INDEX em `tenant_id`.

**Requisito:**
```sql
-- CORRETO (research.md dec-001):
CREATE UNIQUE INDEX mv_platform_metrics_pk ON mv_platform_metrics (tenant_id);

-- INCORRETO (não usar):
-- CREATE UNIQUE INDEX idx_mv_platform_metrics_singleton ON mv_platform_metrics ((1));
```
- A `spec.md` deve ser corrigida na seção "UNIQUE INDEX" (tarefa de documentação no execute-task).
- `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics` requer este índice.

**Validação:**
```sql
-- Após migration:
\d+ mv_platform_metrics  -- deve mostrar unique index sobre tenant_id
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics;  -- deve suceder sem erro
```

---

### INF-02 — FlowProducer árvore invertida (platform=PARENT, tenant=CHILD)

**Status:** REQUISITO TESTÁVEL CRÍTICO

**Contexto:** Semântica BullMQ: em um flow, **children executam ANTES do parent**. Para garantir "platform-refresh APÓS tenant-refresh", a árvore DEVE ser invertida: `refresh-platform-views` como PARENT, `refresh-tenant-views` como CHILD. Esta é a Opção A de dec-008 (recomendada no research.md).

**Requisito OBRIGATÓRIO:**
```typescript
// bullmq.service.ts — createFlowProducer()
await this.flow.add({
  name: 'refresh-platform-views',   // PARENT (executa após children completarem)
  queueName: REPORTS_QUEUE_NAME,
  data: {},
  children: [
    {
      name: 'refresh-tenant-views',  // CHILD (executa PRIMEIRO — antes do parent)
      queueName: REPORTS_QUEUE_NAME,
      data: {},
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        failParentOnFailure: false,  // falha do tenant-refresh NÃO bloqueia platform-refresh
      },
    },
  ],
  opts: {
    jobId: 'refresh-platform-views-scheduler',
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
});
```

- **Comentário OBRIGATÓRIO no código:** `// NOTA: árvore invertida — "parent" aqui é o job que executa POR ÚLTIMO (platform-refresh), e "child" é o job que executa PRIMEIRO (tenant-refresh). Isso respeita a semântica BullMQ onde children rodam antes do parent.`
- Substituir o scheduler existente de `refresh-tenant-views` (que usa `queue.add()` direto) por este flow.

**Teste obrigatório:**
```typescript
it('FlowProducer: tenant-child completa antes de platform-parent iniciar', async () => {
  // integration: enfileirar flow; verificar ordem de execução via eventos BullMQ
  // platform-parent só dispara após tenant-child status=completed
});
```

---

### INF-03 — createPrivilegedClient() no refresh-platform-views.processor.ts

**Status:** REQUISITO TESTÁVEL

**Contexto:** O `refresh-tenant-views.processor.ts` (confirmado via leitura do arquivo real) já implementa `createPrivilegedClient()` com `PrismaPg` + `DATABASE_URL`. O novo processor de platform-views DEVE replicar exatamente este padrão.

**Requisito:**
- Replicar `createPrivilegedClient()` do processor existente.
- `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics` via `privileged.$executeRawUnsafe()` (FORA de `$transaction`).
- `finally { await privileged.$disconnect(); }` — OBRIGATÓRIO para não vazar conexão.
- Gravar `mv_refresh_log`: `mvName: 'mv_platform_metrics'`, `tenantId: null`, `status: 'success'|'failed'`, `durationMs`.

**Teste obrigatório:**
```typescript
it('usa privileged client e desconecta no finally', async () => {
  const mockPriv = { $executeRawUnsafe: jest.fn(), $disconnect: jest.fn() };
  jest.spyOn(processor, 'createPrivilegedClient').mockReturnValue(mockPriv);
  // act: processRefresh(job)
  // assert: $executeRawUnsafe chamado com 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics'
  // assert: $disconnect chamado mesmo se $executeRawUnsafe lançar
});
```

---

### INF-04 — Alerta se refresh > 5min

**Status:** REQUISITO TESTÁVEL

**Contexto:** O AC-13-4 exige alerta se duração > 5min. O processor existente implementa este padrão com `SLOW_THRESHOLD_MS`.

**Requisito:**
```typescript
const SLOW_THRESHOLD_MS = 5 * 60 * 1_000; // 5min

if (durationMs > SLOW_THRESHOLD_MS) {
  this.logger.warn(
    { mvName: 'mv_platform_metrics', durationMs, correlationId },
    'mv_platform_refresh_slow',
  );
}
```

**Teste obrigatório:**
```typescript
it('emite warn mv_platform_refresh_slow se durationMs > 300_000', async () => {
  jest.spyOn(Date, 'now')
    .mockReturnValueOnce(1000)    // startedAt
    .mockReturnValueOnce(311_000); // after refresh
  // assert: logger.warn chamado com 'mv_platform_refresh_slow'
});
```

---

### INF-05 — Child failure isolado (failParentOnFailure:false)

**Status:** REQUISITO TESTÁVEL

**Contexto:** Se o tenant-refresh (CHILD na árvore invertida) falhar, o platform-refresh (PARENT) deve ser impedido de rodar (`failParentOnFailure:false` no child opts, que nesta árvore invertida significa: falha do tenant impede o platform). Se o platform-refresh falhar após o tenant já ter rodado, o tenant não deve ser revertido.

**Requisito:**
- `failParentOnFailure: false` no opts do child `refresh-tenant-views`.
- Falha do platform-refresh: gravar `mv_refresh_log` `status='failed'` + rethrow (BullMQ retry automático via `attempts: 3`).
- Alertas independentes: falha do tenant-refresh logada no tenant-processor; falha do platform-refresh logada no platform-processor.

**Teste obrigatório:**
```typescript
it('falha no platform-refresh não afeta status do tenant-refresh', async () => {
  // integration: tenant-child completa com success; platform-parent lança erro
  // assert: tenant-refresh job status = 'completed'
  // assert: platform-refresh job status = 'failed' (e será retentado pelo BullMQ)
  // assert: mv_refresh_log tem 1 entry status='failed' para mv_platform_metrics
});
```

---

## API

### API-01 — Envelope {data, meta?} canônico

**Status:** REQUISITO TESTÁVEL

**Requisito:**
- `GET /api/v1/admin/platform-metrics/summary` → `{ data: PlatformMetricsSummary, meta: { generatedAt: string, cacheTTL: 300 } }`
- `GET /api/v1/admin/platform-metrics/tenants` → `{ data: PlatformMetricsTenantItem[], meta: { total: number, page: number, limit: number, totalPages: number } }`
- Erros: `{ statusCode, error, message, details? }` — sem stack traces.
- Schemas Zod em `packages/types/src/platform-metrics.ts` (re-exportados em `index.ts`).

**Teste obrigatório:**
```typescript
// packages/types/src/__tests__/platform-metrics.snapshot.spec.ts
it('PlatformMetricsSummaryResponseSchema snapshot', () => {
  expect(PlatformMetricsSummaryResponseSchema.parse(mockSummaryResponse)).toMatchSnapshot();
});

it('PlatformMetricsTenantListResponseSchema snapshot', () => {
  expect(PlatformMetricsTenantListResponseSchema.parse(mockTenantListResponse)).toMatchSnapshot();
});
```

---

### API-02 — Redis cache summary TTL 5min

**Status:** REQUISITO TESTÁVEL

**Requisito:**
- Cache key: `cache:platform-metrics:summary` (namespace `cache:*` conforme CLAUDE.md).
- TTL: 300 segundos (`EX 300`).
- Cache hit: response time target < 100ms; `meta.cacheTTL` sempre = 300.
- Cache miss: query na MV via `$queryRaw` → SET no Redis → retornar.
- Sem invalidação manual (TTL passivo — refresh da MV a cada 15min garante dados frescos).
- `meta.generatedAt`: timestamp da geração (não do cache hit).

**Teste obrigatório:**
```typescript
it('cache hit: não executa $queryRaw na 2ª chamada', async () => {
  const spy = jest.spyOn(prisma, '$queryRaw');
  await service.getSummary(); // miss — popula cache
  await service.getSummary(); // hit
  expect(spy).toHaveBeenCalledTimes(1); // só 1 query SQL
});
```

---

### API-03 — Tenants paginados com meta completo

**Status:** REQUISITO TESTÁVEL

**Requisito:**
- Defaults: `page=1`, `limit=20`. Max limit: 100 (Zod: `z.number().int().min(1).max(100)`).
- `meta.totalPages = Math.ceil(total / limit)`.
- `meta` nunca `undefined` na resposta.
- Filtros: `status ∈ {active, inactive}`, `plan ∈ {free, pro, enterprise}`.
- `sortBy` e `sortDir` com defaults `tenantName` e `asc`.

**Teste obrigatório:**
```typescript
it('42 tenants com limit=20: meta.totalPages=3, meta.total=42', async () => {
  // arrange: 42 tenants no banco
  // act: GET .../tenants?page=1&limit=20
  // assert: response.body.meta = { total: 42, page: 1, limit: 20, totalPages: 3 }
});

it('limit > 100 é rejeitado com 400', async () => {
  // GET .../tenants?limit=101 → 400
});
```

---

### API-04 — Churn via last_seen_at (proxy documentado)

**Status:** REQUISITO TESTÁVEL

**Decisão D1 (resolvida nesta fase):** `activeTenants` usa janela 30d rolling (alinha com AC); `churnedTenants`/`netGrowth` usam mês calendário (alinha com dec-006). São métricas distintas com janelas distintas.

**Requisito:**
- MV deve ter coluna `active_last_30d boolean` (além das existentes `active_current_month`, `active_prev_month`):
  ```sql
  (COALESCE(
    (SELECT COUNT(*) FROM users u
     WHERE u.tenant_id = t.id
       AND u.tenant_id IS NOT NULL
       AND u.last_seen_at >= now() - interval '30 days'), 0
  ) > 0) AS active_last_30d
  ```
- `activeTenants` no summary = `COUNT(*) FILTER (WHERE active_last_30d)`.
- `churnedTenants` = `COUNT(*) FILTER (WHERE active_prev_month AND NOT active_current_month)`.
- JSDoc no service: `/** activeTenants usa last_seen_at como proxy de login (30d rolling). Se "login estrito" for exigido, adicionar tracking de last_login — follow-up. */`

**Teste obrigatório:**
```typescript
it('tenant com last_seen_at=mês anterior mas não no corrente conta como churned', async () => {
  // arrange: tenant com last_seen_at = 1º dia do mês anterior
  // assert: churnedTenants += 1
});

it('tenant com last_seen_at=29 dias atrás conta como active_last_30d', async () => {
  // arrange: tenant com last_seen_at = now() - 29 dias
  // assert: activeTenants += 1
});
```

---

## Migration

### MIG-01 — Auditoria de colunas SQL vs schema Prisma

**Status:** OK COM NOTA

**Confirmações (colunas reais do schema Prisma):**

| Coluna MV | Fonte SQL | Campo Prisma | Status |
|-----------|-----------|-------------|--------|
| `tenant_id` | `t.id` (PK de tenants) | `Tenant.id @id` | OK — ver MIG-02 |
| `tenant_name` | `t.name` | `Tenant.name String` | OK |
| `tenant_status` | `t.status` | `Tenant.status VarChar(32)` | OK |
| `tenant_plan` | `t.plan` | `Tenant.plan VarChar(20) @default("free")` | ADICIONAR (ver GAP-03 resolvido) |
| `tenant_created_at` | `t.created_at` | `Tenant.createdAt @map("created_at")` | OK |
| `total_users` | `COUNT(u)` WHERE `u.tenant_id = t.id AND u.tenant_id IS NOT NULL` | `User.tenantId String?` (nullable!) | OK — JOIN com IS NOT NULL |
| `active_users` | users com `last_seen_at >= date_trunc('month', now())` | `User.lastSeenAt @map("last_seen_at") Timestamptz?` | OK |
| `total_groups` | `COUNT(g)` | `Group.tenantId` | OK |
| `meetings_held` | `COUNT(m) WHERE m.status = 'ended'` | `Meeting.status @default("scheduled")` — 'ended' é valor válido | OK |
| `storage_bytes_used` | `COALESCE(tsu.bytes_used, 0)` | `tenant_storage_usage.bytes_used BIGINT` (tabela nova) | OK |
| `active_current_month` | bool | derivado de `last_seen_at` | OK |
| `active_prev_month` | bool | derivado de `last_seen_at` | OK |
| `active_last_30d` | bool | NOVO — ver API-04 | ADICIONAR |
| `total_trails` | `COUNT(tr)` | `Trail.tenantId` | ADICIONAR (ver GAP-02 resolvido) |
| `refreshed_at` | `now()` | — | OK |

**Nota crítica:** `User.tenantId` é **nullable** (`String?`). O SQL da MV DEVE filtrar `u.tenant_id IS NOT NULL` para evitar contagens incorretas.

---

### MIG-02 — ALERTA CRÍTICO: Tenant.id vs Tenant.tenantId

**Status:** ALERTA CRÍTICO

**Contexto:** O model Prisma `Tenant` tem **dois campos distintos**:
- `id String @id @db.Uuid` — a chave primária real
- `tenantId String @map("tenant_id") @db.Uuid` — campo separado (não é a PK!)

Todas as tabelas relacionadas (`users`, `groups`, `meetings`, `tenant_storage_usage`) fazem FK para `tenants.id` (a PK), não para `tenants.tenant_id`.

**Requisito OBRIGATÓRIO:**
```sql
-- CORRETO:
SELECT t.id AS tenant_id, t.name AS tenant_name, ...
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id AND u.tenant_id IS NOT NULL
...

-- INCORRETO (NÃO fazer):
-- SELECT t.tenant_id AS tenant_id FROM tenants t
-- LEFT JOIN users u ON u.tenant_id = t.tenant_id  -- ERRADO: t.tenant_id != t.id
```

**Validação pré-fechamento de execute-task:**
```sql
-- Confirmar que a MV retorna dados corretos vs consulta direta:
SELECT COUNT(*) FROM mv_platform_metrics;  -- deve = SELECT COUNT(*) FROM tenants
SELECT m.tenant_id, COUNT(u.*) FROM mv_platform_metrics m
JOIN tenants t ON t.id = m.tenant_id
LEFT JOIN users u ON u.tenant_id = t.id
GROUP BY m.tenant_id
LIMIT 5;  -- deve bater com total_users da MV
```

---

### MIG-03 — RLS tenant_storage_usage padrão canônico

**Status:** REQUISITO TESTÁVEL

**Requisito (SQL completo obrigatório na migration):**
```sql
-- 1. Criar tabela
CREATE TABLE tenant_storage_usage (
  tenant_id  UUID    PRIMARY KEY,
  bytes_used BIGINT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS obrigatório (padrão canônico nullif)
ALTER TABLE tenant_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_storage_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_storage_usage
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 3. GRANTs (app role precisa de INSERT + UPDATE para o hook de upload)
GRANT SELECT, INSERT, UPDATE ON tenant_storage_usage TO metanoia_app;
```

---

### MIG-04 — GRANTs da MV mv_platform_metrics

**Status:** REQUISITO TESTÁVEL

**Requisito:**
```sql
-- A MV NÃO tem RLS por design (cross-tenant — controle via guard NestJS)
GRANT SELECT ON mv_platform_metrics TO metanoia_app;
-- NÃO conceder INSERT/UPDATE/DELETE — MV é read-only para a aplicação
```

---

## Gaps da Spec (resolvidos nesta fase)

### GAP-01 — activeTenants: janela 30d rolling (resolvido)

**Decisão D1:** `activeTenants` = 30d rolling (alinha com AC-13-4 "at least 1 login in last 30d").
`churnedTenants` = mês calendário (alinha com dec-006).
Implementação: coluna `active_last_30d boolean` na MV (ver API-04).

**Impacto no data-model.md:** adicionar `active_last_30d` à tabela de colunas da MV.

---

### GAP-02 — totalTrails/averageAttendance/averageTrailCompletion (parcialmente resolvido)

**Decisão D2:**
- `totalTrails` → **INCLUIR** na MV: `COUNT(DISTINCT tr.id) AS total_trails` via LEFT JOIN com tabela `trails` por `tenant_id`.
- `averageAttendance` (platform-wide) → **FOLLOW-UP MVP**: requer JOIN `meeting_attendance` e cálculo complexo. Marcar como 0 na resposta com campo `averageAttendanceMvpNote: "requires-follow-up"`, ou simplesmente omitir do MVP.
- `averageTrailCompletion` → **FOLLOW-UP MVP**: requer JOIN `lesson_progress` e cálculo de completion rate. Omitir do MVP.

**Impacto:** O AC-13-4 menciona esses campos mas a spec.md os omite. Para MVP: incluir `totalTrails`, documentar `averageAttendance` e `averageTrailCompletion` como follow-up explícito no service e no AC.

---

### GAP-03 — campo plan ausente na MV (resolvido)

**Decisão D4:** Adicionar `tenant_plan VARCHAR(20)` à MV (`t.plan AS tenant_plan`).
O endpoint `/tenants` aceita filtro por `plan` e o AC menciona `plan` na resposta.
Não incluir `tenantPlan` no `sortBy` whitelist (não é métrica numérica).

---

## Decisões Auditáveis (registradas no state.json)

| ID | Decisão | Score |
|----|---------|-------|
| D1 | activeTenants = 30d rolling; churn = mês calendário | 2 |
| D2 | totalTrails incluso; averageAttendance/Completion = follow-up | 2 |
| D3 | FlowProducer árvore invertida (opção A dec-008) confirmada como requisito | 3 |
| D4 | tenant_plan adicionado à MV; não entra no sortBy | 2 |
| D5 | SQL usa t.id (PK) como chave da MV, não t.tenant_id | 3 |

---

## Resumo de Artefatos a Atualizar no execute-task

1. **`data-model.md`** → adicionar colunas `active_last_30d`, `tenant_plan`, `total_trails` à tabela da MV.
2. **`spec.md`** → corrigir seção "UNIQUE INDEX" de `((1))` para `(tenant_id)`.
3. **`research.md`** → documentar D1 (30d rolling vs mês calendário) como adendo ao dec-006.
4. **`migration.sql`** → SQL completo da MV com todas as colunas auditadas.
5. **`packages/types/src/platform-metrics.ts`** → schemas Zod completos.

---

*Checklist gerado pela fase checklist do pipeline SDD feature-00c — metricas-plataforma (FR67)*
