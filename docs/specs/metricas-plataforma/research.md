# Phase 0 — Research: Métricas de Plataforma (FR67)

Todas as NEEDS CLARIFICATION foram resolvidas no `/clarify` (8 decisões) e validadas
contra o código real via read-back PRE-DECISÃO. Este documento consolida o **SQL da MV**,
a **lógica de churn** e o **fluxo BullMQ**.

---

## Decision 1 — Materialized View `mv_platform_metrics` (singleton summary + por-tenant)

**Decision**: criar UMA migration com (a) tabela `tenant_storage_usage`, (b) MV
`mv_platform_metrics` cross-tenant, (c) UNIQUE INDEX p/ `REFRESH CONCURRENTLY`, (d) GRANTs.
A MV serve AMBOS os endpoints: o `summary` lê a linha agregada; o `tenants` lê uma linha
por tenant. **Opção adotada**: MV com granularidade **por tenant** (uma linha por tenant)
+ o `summary` é computado como agregação SQL sobre essa MV (`SUM`/`COUNT` no service),
evitando duas MVs. O singleton index aplica-se à abordagem alternativa (MV summary de 1
linha); como adotamos por-tenant, o UNIQUE INDEX é sobre `tenant_id` (sempre presente, 1
linha por tenant), satisfazendo `CONCURRENTLY` sem expressão `((true))`.

**SQL da migration** (replicando padrão 13-2b — auditar colunas):

```sql
-- ============================================================
-- 13-4: Métricas de Plataforma (FR67)
-- Prisma não modela MVs — SQL bruto; aplicado via migrate deploy.
-- ============================================================

-- 1. Tabela de uso de storage por tenant (dec-007)
CREATE TABLE tenant_storage_usage (
  tenant_id  UUID         PRIMARY KEY,
  bytes_used BIGINT       NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 1.a RLS closed-by-default (padrão canônico nullif — igual mv_refresh_log)
ALTER TABLE tenant_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_storage_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_storage_usage
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 1.b GRANTs para o app role (escrita pelo hook de upload)
GRANT SELECT, INSERT, UPDATE ON tenant_storage_usage TO metanoia_app;

-- 2. Materialized View cross-tenant (uma linha por tenant)
--    NOTA: lê tenant_storage_usage com COALESCE(bytes_used, 0).
--    last_seen_at é o proxy de "login" (NÃO existe users.last_login).
CREATE MATERIALIZED VIEW mv_platform_metrics AS
WITH tenant_users AS (
  SELECT u.tenant_id,
         COUNT(*)                                          AS total_users,
         COUNT(*) FILTER (
           WHERE u.last_seen_at >= date_trunc('month', now())
         )                                                 AS active_users_current_month,
         COUNT(*) FILTER (
           WHERE u.last_seen_at >= date_trunc('month', now()) - interval '1 month'
             AND u.last_seen_at <  date_trunc('month', now())
         )                                                 AS active_users_prev_month
  FROM users u
  WHERE u.tenant_id IS NOT NULL
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
  t.created_at                                        AS tenant_created_at,
  COALESCE(tu.total_users, 0)::int                    AS total_users,
  COALESCE(tu.active_users_current_month, 0)::int     AS active_users,
  COALESCE(tg.total_groups, 0)::int                   AS total_groups,
  COALESCE(tm.meetings_held, 0)::int                  AS meetings_held,
  COALESCE(tsu.bytes_used, 0)::bigint                 AS storage_bytes_used,
  -- flags de atividade p/ churn cross-tenant (consumidas no service)
  (COALESCE(tu.active_users_current_month, 0) > 0)    AS active_current_month,
  (COALESCE(tu.active_users_prev_month, 0)    > 0)    AS active_prev_month,
  now()                                               AS refreshed_at
FROM tenants t
LEFT JOIN tenant_users    tu  ON tu.tenant_id  = t.id
LEFT JOIN tenant_groups   tg  ON tg.tenant_id  = t.id
LEFT JOIN tenant_meetings tm  ON tm.tenant_id  = t.id
LEFT JOIN tenant_storage_usage tsu ON tsu.tenant_id = t.id;

-- 3. UNIQUE INDEX (obrigatório para REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX mv_platform_metrics_pk ON mv_platform_metrics (tenant_id);

-- 4. GRANT de leitura para o app role (endpoints leem via PrismaService normal)
GRANT SELECT ON mv_platform_metrics TO metanoia_app;
```

**Rationale**: por-tenant é a granularidade mínima que serve os dois endpoints sem segunda
MV. O `summary` agrega `SUM(total_users)`, `SUM(storage_bytes_used)`, `COUNT(*) AS
total_tenants`, etc. no service via `$queryRaw` sobre a MV.

**Alternatives considered**:
- *Duas MVs* (summary singleton de 1 linha com `((true))` index + tenants): mais SQL,
  dois REFRESH, drift entre elas. Rejeitada.
- *MV summary apenas + endpoint /tenants ao vivo*: o `/tenants` ficaria sem cache/MV,
  custoso cross-tenant. Rejeitada.

**Validação obrigatória pré-fechamento do execute-task**: rodar o SQL contra o Postgres
local (`docker compose`), confirmar que cada coluna referenciada existe (lição 13-2b:
`groups` não tem `deleted_at`; enums em PT). Conferir `users.last_seen_at`,
`meetings.status` valores reais (`'ended'`/`'realizado'`), `tenants.status`.

---

## Decision 2 — Churn / netGrowth por mês calendário (dec-006)

**Decision**: calcular no **service** (TS) a partir das flags `active_current_month` /
`active_prev_month` da MV. Definições:

- **Tenant ativo no mês** = possui >=1 usuário com `last_seen_at` dentro do range do mês
  (`date_trunc('month', now())` para o corrente; mês anterior = range deslocado 1 mês).
- **churnedTenants** = `COUNT(*) WHERE active_prev_month = true AND active_current_month = false`.
- **newTenants** = `COUNT(*) FROM tenants WHERE created_at >= date_trunc('month', now())`
  (computado no service via `$queryRaw` separado OU coluna derivada na MV).
- **netGrowth** = `newTenants - churnedTenants`.

SQL do `summary` (sobre a MV + tenants):
```sql
SELECT
  COUNT(*)::int                                              AS total_tenants,
  COALESCE(SUM(total_users), 0)::int                         AS total_users,
  COALESCE(SUM(active_users), 0)::int                        AS active_users,
  COALESCE(SUM(total_groups), 0)::int                        AS total_groups,
  COALESCE(SUM(meetings_held), 0)::int                       AS meetings_held,
  COALESCE(SUM(storage_bytes_used), 0)::bigint               AS storage_bytes_used,
  COUNT(*) FILTER (WHERE active_prev_month AND NOT active_current_month)::int AS churned_tenants,
  COUNT(*) FILTER (WHERE tenant_created_at >= date_trunc('month', now()))::int AS new_tenants
FROM mv_platform_metrics;
-- netGrowth = new_tenants - churned_tenants  (no service)
```

**Rationale**: usar `last_seen_at` como proxy de login é a única opção — **não existe
`users.last_login`** no schema (read-back confirmou `users.last_seen_at @map("last_seen_at")`).
Documentar essa substituição como premissa explícita (se o produto exigir "login" estrito,
é follow-up adicionar tracking de login real).

**Alternatives considered**: usar `meeting_attendance` como sinal de atividade — mais
preciso para engajamento, mas não representa "ativo/login" e ignora tenants sem reuniões.
Rejeitada para o MVP; `last_seen_at` é o sinal canônico de presença do usuário.

---

## Decision 3 — Child job BullMQ via FlowProducer (dec-008)

**Decision**: adicionar `createFlowProducer(): FlowProducer` ao `BullMqService` (mesma
connection config de `createQueue`). O processor pai `refresh-tenant-views` passa a
enfileirar via FlowProducer um **flow** com o child `refresh-platform-views` rodando APÓS
o pai. Novo processor `refresh-platform-views.processor.ts` registra o worker do child.

Estrutura do flow (BullMQ ^5.73.3):
```ts
// no scheduler (a cada */15): em vez de queue.add(parent), usar flow.add({...})
await this.flow.add({
  name: 'refresh-tenant-views',
  queueName: REPORTS_QUEUE_NAME,
  data: {},
  children: [
    {
      name: 'refresh-platform-views',
      queueName: REPORTS_QUEUE_NAME,
      data: {},
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        failParentOnFailure: false,   // dec-008: falha do child NÃO reverte o pai
      },
    },
  ],
  opts: { jobId: 'refresh-tenant-views-scheduler', attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 } },
});
```
> NOTA SEMÂNTICA BullMQ: em um flow, os **children rodam ANTES do parent** (o parent
> aguarda os children). dec-008 quer o platform-refresh "após o pai". Resolver de UMA das
> formas (decisão de implementação no execute-task, sem reabrir dec-008):
> **(A)** inverter a árvore — `refresh-platform-views` é o PARENT e `refresh-tenant-views`
> é o CHILD (tenant roda primeiro, platform consome o resultado depois); OU
> **(B)** manter dois jobs encadeados via evento de conclusão. **Recomendado: (A)** —
> respeita "platform depois de tenant" com a semântica nativa de flow e mantém
> `failParentOnFailure:false` no sentido correto (falha do platform-refresh, agora parent,
> não afeta o tenant-refresh já concluído). Documentar a escolha final no execute-task.

O worker do child replica `createPrivilegedClient()` do `refresh-tenant-views.processor.ts`:
`PrismaPg` adapter + `DATABASE_URL` (superuser), `REFRESH MATERIALIZED VIEW CONCURRENTLY
mv_platform_metrics` FORA de `$transaction`, `await privileged.$disconnect()` no `finally`,
e grava `mv_refresh_log` (`mvName:'mv_platform_metrics'`, `tenantId:null`, status, durationMs).

**Rationale**: FlowProducer dá encadeamento nativo e observabilidade (parent-child) sem
um segundo scheduler. `failParentOnFailure:false` isola a falha (alerta independente).

**Alternatives considered**: job independente com cron `*/15` próprio — perde o "após o
pai" e cria duas janelas de refresh concorrentes sobre o mesmo DB. Rejeitada (dec-008).

---

## Decision 4 — Cache Redis (dec/spec)

**Decision**: `summary` cacheado em `cache:platform-metrics:summary` TTL 300s via
`RedisService` (ioredis): `await this.redis.set(key, JSON.stringify(payload), 'EX', 300)`
e `const raw = await this.redis.get(key)`. Cache-aside: miss → query MV → set → return.
O endpoint `/tenants` (paginado, parametrizado por page/sort/filter) **não** é cacheado
nesta story (cardinalidade de chaves alta; MV já é o cache de dados).

**Rationale**: replicar API ioredis já usada em `audit-export.processor.ts` (`.set(k,v,'EX',ttl)`).

---

## Decision 5 — Hook de storage (dec-007)

**Decision**: em `StorageService.upload(objectKey, buffer, mimeType)`, após `putObject`,
fazer UPSERT em `tenant_storage_usage` incrementando `bytes_used += buffer.length` para o
tenant corrente, resolvido via `RequestContext`/`withTenantTx` (NUNCA `tenantId` como
parâmetro). `StorageModule` passa a importar `PrismaModule`.

```ts
// pseudo — dentro de upload(), após putObject:
await withTenantTx(this.prisma, async (tx) => {
  await tx.$executeRaw`
    INSERT INTO tenant_storage_usage (tenant_id, bytes_used, updated_at)
    VALUES (NULLIF(current_setting('app.current_tenant_id', true), '')::uuid, ${buffer.length}, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET bytes_used = tenant_storage_usage.bytes_used + ${buffer.length},
                  updated_at = now();
  `;
});
```

**Risco documentado**: `upload()` pode ser chamado **fora de contexto de request** (ex:
jobs/seed sem `app.current_tenant_id` setado) → o `NULLIF(...)::uuid` resultaria em `NULL`
e o INSERT violaria o PK NOT NULL. Mitigação no execute-task: guardar o hook com
verificação de tenant corrente presente; se ausente, **logar warn e pular** o incremento
(não falhar o upload). Decremento no `delete()` é **FOLLOW-UP** (delete não implementado).

**Alternatives considered**: job periódico consultando MinIO (CLARIFY-02 Opção B) —
latência alta, rejeitada. Stub bytes=0 (Opção C) — não reflete dados reais; rejeitada
porque StorageService já existe.
