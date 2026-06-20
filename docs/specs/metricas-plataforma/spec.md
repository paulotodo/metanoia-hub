# Feature Spec: Métricas de Plataforma — Super Admin (FR67)

**Story:** 13.4 — Epic 13: Relatórios Avançados & Analytics
**Feature ID:** metricas-plataforma
**FR:** FR67
**Status:** draft
**Criado em:** 2026-06-19

---

## Sumário

### Objetivo

Prover ao Super Admin métricas agregadas cross-tenant da plataforma via `GET /api/v1/admin/platform-metrics/summary` (totais) e `GET /api/v1/admin/platform-metrics/tenants` (lista paginada por tenant). Os dados são servidos a partir de materialized view `mv_platform_metrics` (PostgreSQL), atualizada a cada 15 minutos como child job BullMQ do job pai `refresh-tenant-views` (Story 13.2b), com cache Redis de 5 minutos na camada de API.

### Escopo IN

- Materialized view `mv_platform_metrics` com todas as colunas de agregação cross-tenant
- UNIQUE INDEX na MV para suporte a `REFRESH CONCURRENTLY`
- Job BullMQ `refresh-platform-views` como child do `refresh-tenant-views` (FlowProducer)
- Endpoint `GET /api/v1/admin/platform-metrics/summary` com cache Redis
- Endpoint `GET /api/v1/admin/platform-metrics/tenants` (paginado, sort, filtro)
- Zod schemas `PlatformMetricsSummarySchema` e `PlatformMetricsTenantListSchema` em `packages/types` + snapshot tests
- Tabela `tenant_storage_usage` (nova — ver dependência abaixo)
- Extensão do módulo `super-admin` existente (`apps/api/src/super-admin/`)

### Escopo OUT

- UI/dashboard frontend (fora desta story)
- Query ao MinIO em tempo real (proibido — usar `tenant_storage_usage`)
- Refresh manual sob demanda (sem endpoint POST nesta story)
- Outros endpoints super-admin não relacionados a métricas de plataforma

### Pré-requisitos confirmados

- Story 13.2b entregue: `refresh-tenant-views` processor em `apps/api/src/reports/jobs/refresh-tenant-views.processor.ts` existe e usa `createPrivilegedClient()` com `DATABASE_URL` superuser
- Módulo `apps/api/src/super-admin/` existente com `Role.SUPER_ADMIN = 'super_admin'` em `apps/api/src/auth/enums/role.enum.ts`
- `RolesGuard` em `apps/api/src/auth/roles.guard.ts` — `super_admin` bypassa todas as restrições de role (cross-tenant by design)
- Epic 5 (reuniões), Epic 8 (trilhas): modelos `Meeting`, `Trail`, `Group` com `tenant_id` no schema Prisma

---

## Risco Crítico: Refresh de MV Cross-Tenant Requer Conexão Privilegiada

**Lição da Story 13.2b (já implementada):** `REFRESH MATERIALIZED VIEW CONCURRENTLY` exige que o executor seja OWNER da MV e que possa ver todos os tenants. O role de aplicação `metanoia_app` (NOSUPERUSER) não é owner e está sujeito a RLS nas tabelas base. A MV `mv_platform_metrics` agrega dados de TODOS os tenants — se o refresh rodar com `metanoia_app`, a MV ficará vazia ou incompleta.

**Solução obrigatória:** O job `refresh-platform-views` DEVE usar `createPrivilegedClient()` idêntico ao `refresh-tenant-views.processor.ts` — conexão com `DATABASE_URL` (role superuser), nunca via `$transaction`, sempre com `await privileged.$disconnect()` no bloco `finally`.

Padrão obrigatório (replicar do job pai):

```typescript
private createPrivilegedClient(): PrismaClient {
  const connectionString = this.configService.get('DATABASE_URL', { infer: true });
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
// REFRESH CONCURRENTLY diretamente via $queryRaw
// NUNCA dentro de $transaction — CONCURRENTLY não funciona em transação.
```

**Leitura da MV nos endpoints:** Os endpoints `GET /api/v1/admin/platform-metrics/*` usam o `PrismaService` normal (role `metanoia_app`), pois a MV `mv_platform_metrics` NÃO tem RLS (é cross-tenant e foi criada pelo superuser). O `metanoia_app` pode fazer SELECT na MV mediante `GRANT SELECT ON mv_platform_metrics TO metanoia_app` (incluir na migration).

---

## Dependência Crítica: tenant_storage_usage (Tabela Ausente)

A coluna `storageUsed` deve vir de uma tabela `tenant_storage_usage` (tenant_id, bytes_used, updated_at). Esta tabela **NÃO existe** no schema Prisma atual.

**Items a resolver no clarify/plan:**

1. **Criar a tabela** `tenant_storage_usage` via migration Prisma:
   ```sql
   CREATE TABLE tenant_storage_usage (
     tenant_id UUID PRIMARY KEY,
     bytes_used BIGINT NOT NULL DEFAULT 0,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```

2. **Mecanismo de população** (a definir no clarify — 3 opções):
   - **Opção A (preferida):** Hook no `StorageService` no evento de upload/delete no MinIO — incrementa/decrementa `bytes_used` atomicamente via `UPDATE ... SET bytes_used = bytes_used + $delta`
   - **Opção B:** Job periódico separado que consulta MinIO (impacto de latência, não recomendado)
   - **Opção C:** Stub inicial com `bytes_used = 0` (MVP aceitável se StorageService ainda não existe)

3. **Para a MV:** `storageUsed` = `COALESCE(SUM(tsu.bytes_used), 0)` via JOIN com `tenant_storage_usage`

**DECISÃO PENDENTE (clarify):** Opção A/B/C e se o `StorageService` de upload/MinIO já existe em outro Epic.

---

## User Stories

### US-01: Resumo agregado da plataforma (Super Admin)

```
Como Super Admin,
Quero acessar GET /api/v1/admin/platform-metrics/summary,
Para obter métricas agregadas cross-tenant da plataforma em tempo quasi-real.
```

**Acceptance Criteria:**

- **AC-01.1:** Endpoint retorna HTTP 200 com corpo `{ data: PlatformMetricsSummary, meta: { generatedAt: ISO8601, cacheTTL: 300 } }`
- **AC-01.2:** `data` contém todos os campos obrigatórios: `totalTenants`, `activeTenants`, `totalUsers`, `activeUsers`, `totalGroups`, `totalMeetings`, `totalTrails`, `averageAttendance`, `averageTrailCompletion`, `storageUsed`, `churnedTenants`, `netGrowth`
- **AC-01.3:** `activeTenants` = tenants com pelo menos 1 login nos últimos 30 dias
- **AC-01.4:** `activeUsers` = usuários com pelo menos 1 login nos últimos 30 dias
- **AC-01.5:** `totalMeetings` = meetings criadas nos últimos 30 dias
- **AC-01.6:** `storageUsed` (bytes total) vem de `tenant_storage_usage`, nunca de query ao MinIO em tempo real
- **AC-01.7:** Cache Redis key `cache:platform-metrics:summary`, TTL 300s. Cache miss: consulta `mv_platform_metrics` + grava cache. Cache hit: retorna sem consultar banco.
- **AC-01.8:** Resposta em < 100ms em cache hit; < 3s em cache miss (consulta MV)
- **AC-01.9:** Não-super-admin recebe HTTP 403 (`{ statusCode: 403, error: "Forbidden", message: "Insufficient role permissions" }`)

### US-02: Lista paginada de tenants com métricas (Super Admin)

```
Como Super Admin,
Quero acessar GET /api/v1/admin/platform-metrics/tenants,
Para inspecionar métricas individuais por tenant com filtros e ordenação.
```

**Acceptance Criteria:**

- **AC-02.1:** Endpoint retorna HTTP 200 com `{ data: PlatformMetricsTenantItem[], meta: { total, page, limit, totalPages } }`
- **AC-02.2:** Query params: `page` (int, default 1), `limit` (int, default 20, max 100), `sort` (formato `coluna:asc|desc`), `plan` (`free|pro|enterprise`), `status` (`active|inactive`)
- **AC-02.3:** Cada item: `tenantId`, `tenantName`, `plan`, `activeUsers`, `totalGroups`, `totalMeetings`, `storageUsed`, `createdAt` (ISO 8601)
- **AC-02.4:** Sort funciona para qualquer coluna numérica ou de data. Sort inválido retorna 400.
- **AC-02.5:** Filtro `plan` e `status` podem ser combinados. Sem filtro retorna todos.
- **AC-02.6:** `status=active` = tenants com pelo menos 1 login nos últimos 30 dias; `status=inactive` = demais.
- **AC-02.7:** Não-super-admin recebe HTTP 403.
- **AC-02.8:** Sem RLS — super admin vê todos os tenants.

### US-03: Refresh automático via job BullMQ (child job)

```
Como operador da plataforma,
Quero que mv_platform_metrics seja atualizada a cada 15 minutos como child do refresh-tenant-views,
Para que as métricas reflitam dados recentes sem impactar o job pai.
```

**Acceptance Criteria:**

- **AC-03.1:** Job `refresh-platform-views` declarado como child do job `refresh-tenant-views` via BullMQ `FlowProducer` — executa SOMENTE após o job pai completar com sucesso.
- **AC-03.2:** Job usa `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics` via conexão privilegiada (superuser). NUNCA dentro de `$transaction`.
- **AC-03.3:** Timeout do job: 10 minutos.
- **AC-03.4:** Se duração > 5 minutos, emite alerta via logger (`logger.warn`, estruturado JSON com `mv_refresh_slow`).
- **AC-03.5:** Cron de disparo delegado ao job pai (15min); o child não tem cron próprio.
- **AC-03.6:** Após refresh bem-sucedido, invalida cache Redis `cache:platform-metrics:summary` (DEL ou TTL reset).
- **AC-03.7:** Falha do child NÃO falha o job pai — erros do child são isolados.
- **AC-03.8:** Log estruturado em sucesso (`mv_platform_refresh_success`, durationMs) e falha (`mv_platform_refresh_failed`, durationMs, error).

---

## Functional Requirements

| FR | Descrição | ACs |
|----|-----------|-----|
| FR67-01 | MV `mv_platform_metrics` com 12 colunas de agregação cross-tenant + UNIQUE INDEX | AC-01.2, AC-03.2 |
| FR67-02 | Refresh CONCURRENTLY via conexão privilegiada (superuser) | AC-03.2 |
| FR67-03 | BullMQ child job após refresh-tenant-views | AC-03.1 |
| FR67-04 | Endpoint summary com cache Redis 5min | AC-01.7, AC-01.8 |
| FR67-05 | Endpoint tenants paginado com sort e filtro | AC-02.1–AC-02.6 |
| FR67-06 | Guard `@Roles('super_admin')` em ambos os endpoints, sem RLS | AC-01.9, AC-02.7 |
| FR67-07 | Zod schemas + snapshot tests em `packages/types` | (testabilidade) |
| FR67-08 | Tabela `tenant_storage_usage` para storageUsed | AC-01.6 |
| FR67-09 | Invalidação de cache após refresh | AC-03.6 |

---

## Non-Functional Requirements

| NFR | Descrição | Critério |
|-----|-----------|----------|
| NFR-PERF-01 | Cache hit: < 100ms | AC-01.8 |
| NFR-PERF-02 | Cache miss: < 3s para 500+ tenants | AC-01.8 |
| NFR-PERF-03 | Load test: 500 tenants × 10 grupos × 50 participantes — query MV < 3s | Task de teste |
| NFR-SEC-01 | Não-super-admin recebe 403 | AC-01.9, AC-02.7 |
| NFR-SEC-02 | Endpoints cross-tenant: sem RLS, acesso por @Roles exclusivamente | FR67-06 |
| NFR-PRIV-01 | Conexão privilegiada isolada no job — nunca exposta à camada de serviço | AC-03.2 |
| NFR-OBS-01 | Logs estruturados em JSON: durationMs, correlationId, mvName | AC-03.8 |

---

## Schema da MV mv_platform_metrics

### Colunas

| Coluna | Tipo SQL | Descrição |
|--------|----------|-----------|
| `total_tenants` | BIGINT | Total de tenants na plataforma |
| `active_tenants` | BIGINT | Tenants com >=1 login em 30 dias |
| `total_users` | BIGINT | Total de usuários (UserTenant) |
| `active_users` | BIGINT | Usuários com >=1 login em 30 dias |
| `total_groups` | BIGINT | Total de grupos |
| `total_meetings` | BIGINT | Meetings criadas nos últimos 30 dias |
| `total_trails` | BIGINT | Total de trilhas |
| `average_attendance` | NUMERIC(5,2) | Média de presença em meetings (platform-wide) |
| `average_trail_completion` | NUMERIC(5,2) | Média de conclusão de trilhas (platform-wide) |
| `storage_used` | BIGINT | Bytes totais via tenant_storage_usage |
| `churned_tenants` | BIGINT | Tenants ativos no mês anterior, inativos agora |
| `net_growth` | BIGINT | Novos tenants - churned no período |
| `refreshed_at` | TIMESTAMPTZ | Timestamp do último refresh |

### UNIQUE INDEX (obrigatório para REFRESH CONCURRENTLY)

A MV tem exatamente 1 linha (agregação global). O UNIQUE INDEX em coluna constante satisfaz o requisito do PostgreSQL para `REFRESH CONCURRENTLY`:

```sql
CREATE UNIQUE INDEX idx_mv_platform_metrics_singleton
  ON mv_platform_metrics ((1));
```

### Nota: churned_tenants e net_growth — Ambiguidade Pendente

A janela temporal exata para `churned_tenants` e `net_growth` é item de clarify (ver CLARIFY-01 abaixo). Duas opções:
- **Opção A (mês calendário):** Comparação entre mês anterior e mês corrente via `date_trunc`
- **Opção B (janela móvel 30 dias):** Intervalo contínuo 0-30d vs. 30-60d

Opção A é recomendada por legibilidade para relatórios gerenciais mensais.

---

## Contratos de API

### GET /api/v1/admin/platform-metrics/summary

Response 200:
```json
{
  "data": {
    "totalTenants": 142,
    "activeTenants": 98,
    "totalUsers": 4521,
    "activeUsers": 3102,
    "totalGroups": 712,
    "totalMeetings": 1843,
    "totalTrails": 231,
    "averageAttendance": 78.5,
    "averageTrailCompletion": 62.3,
    "storageUsed": 15728640000,
    "churnedTenants": 3,
    "netGrowth": 7
  },
  "meta": {
    "generatedAt": "2026-06-19T14:30:00Z",
    "cacheTTL": 300
  }
}
```

Response 403: `{ "statusCode": 403, "error": "Forbidden", "message": "Insufficient role permissions" }`

### GET /api/v1/admin/platform-metrics/tenants

Query params: `page` (default 1), `limit` (default 20, max 100), `sort` (ex: `activeUsers:desc`), `plan` (`free|pro|enterprise`), `status` (`active|inactive`)

Response 200:
```json
{
  "data": [
    {
      "tenantId": "01930000-0000-7000-8000-000000000001",
      "tenantName": "Igreja Caminho Novo",
      "plan": "pro",
      "activeUsers": 48,
      "totalGroups": 6,
      "totalMeetings": 23,
      "storageUsed": 104857600,
      "createdAt": "2025-03-15T00:00:00Z"
    }
  ],
  "meta": {
    "total": 98,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

Response 400 (sort inválido): `{ "statusCode": 400, "error": "Bad Request", "message": "Invalid sort column: 'foo'" }`

---

## Zod Schemas (packages/types)

```typescript
// packages/types/src/reports/platform-metrics.ts

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
  storageUsed: z.number().int().nonnegative(),  // bytes
  churnedTenants: z.number().int().nonnegative(),
  netGrowth: z.number().int(),                   // pode ser negativo
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
  plan: z.enum(['free', 'pro', 'enterprise']),
  activeUsers: z.number().int().nonnegative(),
  totalGroups: z.number().int().nonnegative(),
  totalMeetings: z.number().int().nonnegative(),
  storageUsed: z.number().int().nonnegative(),  // bytes
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
```

Snapshot tests obrigatórios em `packages/types/src/reports/__tests__/platform-metrics.schema.test.ts`.

---

## Arquitetura de Implementação

### Módulo

Estender `apps/api/src/super-admin/` com subpasta `platform-metrics/`:

```
apps/api/src/super-admin/
  platform-metrics/
    super-admin-platform-metrics.controller.ts
    super-admin-platform-metrics.service.ts
    super-admin-platform-metrics.service.spec.ts
```

O módulo `super-admin-tenants.module.ts` existente será estendido para registrar o novo controller+service.

### Job BullMQ

```
apps/api/src/reports/jobs/
  refresh-platform-views.processor.ts  (child job via FlowProducer)
```

### Migration

```
apps/api/prisma/migrations/YYYYMMDD_create_mv_platform_metrics/
  migration.sql
    -- CREATE TABLE tenant_storage_usage
    -- CREATE MATERIALIZED VIEW mv_platform_metrics
    -- CREATE UNIQUE INDEX idx_mv_platform_metrics_singleton
    -- GRANT SELECT ON mv_platform_metrics TO metanoia_app
    -- GRANT SELECT ON tenant_storage_usage TO metanoia_app
```

### Redis

- Namespace: `cache:platform-metrics:summary` (conforme padrão `cache:*` do projeto)
- TTL: 300s
- Invalidação: DEL após cada refresh bem-sucedido

### Sem RLS

A MV `mv_platform_metrics` e a tabela `tenant_storage_usage` são cross-tenant (sem RLS). O acesso do `metanoia_app` é via GRANT SELECT explícito na migration. O controle de acesso é feito exclusivamente pelo `@Roles(Role.SUPER_ADMIN)` no controller.

---

## Clarifications Pendentes

### CLARIFY-01 — Janela temporal de churnedTenants e netGrowth

**Pergunta:** Qual janela usar para `churnedTenants` e `netGrowth`?
- **Opção A:** Mês calendário corrente vs. mês anterior (date_trunc) — mais legível para relatórios gerenciais
- **Opção B:** Janela móvel 30 dias (intervalo contínuo) — mais "tempo real"

**Impacto:** SQL da MV muda. Recomendação: Opção A.
**Decidível autonomamente:** Score 2 (contexto favorece A, mas requer confirmação de produto).

### CLARIFY-02 — Mecanismo de população de tenant_storage_usage

**Pergunta:** Como `tenant_storage_usage` será alimentada?
- **Opção A:** Hook no `StorageService` (upload/delete) — atomico e tempo-real
- **Opção B:** Job periódico consultando MinIO — latência alta
- **Opção C:** Stub MVP (bytes_used = 0) até StorageService existir

**Impacto:** Determina se a coluna `storageUsed` reflete dados reais no MVP. Confirmar se o StorageService de upload já existe em outro Epic.
**Decidível autonomamente com context:** Score 2 (Opção C se StorageService ausente; Opção A se presente).

### CLARIFY-03 — Isolamento de falha do child job

**Pergunta:** Falha de `refresh-platform-views` deve propagar ao job pai?
- **Opção A:** Retries independentes, falha isolada (não propaga ao pai)
- **Opção B:** Falha do child marca o pai como failed

**Impacto:** Configuração do FlowProducer. Recomendação: Opção A (isolamento).
**Decidível autonomamente:** Score 3 (BullMQ parent/child flow documenta que child failures são isolados por padrão).

---

## Success Criteria

- [ ] `mv_platform_metrics` criada via migration com todos os 12 campos + UNIQUE INDEX + GRANT SELECT
- [ ] Tabela `tenant_storage_usage` criada via migration
- [ ] Job `refresh-platform-views` roda como child do job pai após conclusão
- [ ] Refresh usa conexão privilegiada (DATABASE_URL superuser), nunca $transaction
- [ ] Cache Redis `cache:platform-metrics:summary` TTL 300s, invalidado após refresh
- [ ] `GET /api/v1/admin/platform-metrics/summary` retorna 200 com contrato correto
- [ ] `GET /api/v1/admin/platform-metrics/tenants` paginado com sort e filtro
- [ ] Ambos os endpoints retornam 403 para não-super-admin
- [ ] Zod schemas com snapshot tests em `packages/types`
- [ ] Integration test com 10+ tenants; load test 500 tenants < 3s
- [ ] Logs estruturados em sucesso e falha do job

---

## Referências

- Spec FR65 (Story 13.2b): `docs/specs/relatorio-tenant-mv/spec.md`
- Job pai: `apps/api/src/reports/jobs/refresh-tenant-views.processor.ts`
- Módulo super-admin: `apps/api/src/super-admin/`
- Role enum: `apps/api/src/auth/enums/role.enum.ts`
- Roles guard: `apps/api/src/auth/roles.guard.ts`
- Spec autoritativa BMAD: `_bmad-output/implementation-artifacts/13-4-metricas-de-plataforma-super-admin-fr67.md`
- Epic 13: `_bmad-output/planning-artifacts/epics/epic-13.md`
