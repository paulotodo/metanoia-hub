# Tasks — Relatório por Tenant com Materialized Views (FR65 / Story 13.2b)

> **Feature:** `relatorio-tenant-mv`
> **Pipeline:** specify → clarify → plan → checklist → create-tasks → **execute-task** → review-task
> **Spec:** `docs/specs/relatorio-tenant-mv/spec.md`
> **Plan:** `docs/specs/relatorio-tenant-mv/plan.md`
> **Research SQL:** `docs/specs/relatorio-tenant-mv/research.md`

## Legenda de criticidade

- `[C]` — Crítico: bloqueia merge; RLS, segurança, contrato, migration obrigatória
- `[A]` — Avançado: funcionalidade core, testes obrigatórios, impacto direto no usuário
- `[M]` — Menor: UX, observabilidade, polish, mensagens

## Legenda de status

- `- [ ]` Pendente
- `- [x]` Concluído
- `- [~]` Em andamento
- `- [!]` Bloqueado

## Matriz de Dependências

```
FASE 1 (Migration + Schema)
  └─► FASE 2 (BullMQ Job)          ← depende da MV existir no banco
  └─► FASE 3 (Service + Endpoints) ← depende da MV existir no banco
      └─► FASE 4 (Zod + Types)     ← contratos definidos antes dos testes
      └─► FASE 5 (UI)              ← depende dos endpoints 3.1 e 3.2
  └─► FASE 6 (Testes RLS)          ← depende da MV + service (1.x + 3.1)
FASE 7 (Revisão Final)              ← depende de todas as fases anteriores
```

## Escopo Coberto

- Migration SQL: `mv_tenant_report` (MV com períodos fixos 7d/30d/90d), UNIQUE INDEX, tabela `mv_refresh_log`
- Job BullMQ `refresh-tenant-views` (cron 15min, retry 3x backoff 30s/60s/120s, timeout 10min, alerta Pino)
- Endpoints GET `/api/v1/reports/tenant-summary` + POST `.../refresh` (rate-limit Redis NX atômico)
- Schemas Zod em `packages/types/src/reports/tenant-summary.ts` + snapshot tests (6 schemas)
- UI `/app/admin/reports/tenant-summary` (Client Component, TanStack Query polling, a11y WCAG AA)
- Teste RLS `apps/api/test/rls/mv-tenant-report.rls-spec.ts` (gate obrigatório anti-cross-tenant)
- Acceptance criteria de segurança AC-SEC-01..06 (dec-009 score 3, OWASP gate)

## Escopo Excluído

- Job `refresh-platform-views` (Story 13.4 — future, fora deste escopo)
- MV por tenant (Opção C rejeitada no clarify — inviável 500+ tenants)
- Security-barrier view wrapper (Opção B rejeitada — DDL extra desnecessário)
- RLS nativa na MV via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (Opção D rejeitada)
- Página adicionada ao gate axe público (`a11y-pages.json`/`a11y-checks.yml`) — autenticada
- Novo store Zustand (estado local React suficiente — FR-06)

---

## FASE 1 — Migration: Materialized View + Tabela Auxiliar

### 1.1 Criar migration SQL `add_mv_tenant_report` `[C]`

**Arquivo:** `apps/api/prisma/migrations/YYYYMMDD_add_mv_tenant_report/migration.sql`

Criar arquivo de migration com SQL bruto (Prisma não modela MV nativamente). A migration contém, nesta ordem:

**1. `CREATE MATERIALIZED VIEW mv_tenant_report AS`** — SQL do body une `groups`, `group_members`, `meetings`, `meeting_attendance`, `trail_progress`, `participant_radar_status` com filtros de período fixo em SQL (`CURRENT_TIMESTAMP - INTERVAL '7 days'` etc.). Colunas obrigatórias:
- `tenant_id UUID NOT NULL`
- `group_id UUID NOT NULL`
- `group_name TEXT NOT NULL`
- `leader_name TEXT` (nullable)
- `attendance_avg_7d NUMERIC(5,2)`, `attendance_avg_30d NUMERIC(5,2)`, `attendance_avg_90d NUMERIC(5,2)`
- `trail_progress_avg_7d NUMERIC(5,2)`, `trail_progress_avg_30d NUMERIC(5,2)`, `trail_progress_avg_90d NUMERIC(5,2)`
- `risk_count INT NOT NULL DEFAULT 0`
- `active_participants INT NOT NULL DEFAULT 0`
- `refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()`

SQL completo em `research.md` (Decision 3 — dec-013).

**2. UNIQUE INDEX** — obrigatório para `REFRESH CONCURRENTLY`:
```sql
CREATE UNIQUE INDEX mv_tenant_report_pk ON mv_tenant_report(tenant_id, group_id);
```

**3. Índice de leitura:**
```sql
CREATE INDEX mv_tenant_report_tenant_idx ON mv_tenant_report(tenant_id);
```

**4. `CREATE TABLE mv_refresh_log`** (dec-010):
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id UUID` (NULL = refresh agendado global)
- `mv_name VARCHAR(64) NOT NULL`
- `refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `duration_ms INT NOT NULL`
- `status VARCHAR(16) NOT NULL` — `'success'` | `'failed'`

**5. Índice em `mv_refresh_log`:**
```sql
CREATE INDEX mv_refresh_log_mv_name_idx ON mv_refresh_log(mv_name, refreshed_at);
```

**6. RLS em `mv_refresh_log`** (padrão canônico `20260510210000_consolidate_rls_nullif`):
```sql
ALTER TABLE mv_refresh_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mv_refresh_log
  USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```
Linhas com `tenant_id IS NULL` visíveis a todos (refresh global).

- [x] Migration criada com DDL completo (MV + UNIQUE INDEX + mv_refresh_log + RLS)
- [x] UNIQUE INDEX `(tenant_id, group_id)` presente (obrigatório para REFRESH CONCURRENTLY)
- [x] RLS em `mv_refresh_log` com policy `tenant_isolation` usando `NULLIF(current_setting(...))`

### 1.2 Adicionar `model MvRefreshLog` ao `schema.prisma` `[C]`

**Arquivo:** `apps/api/prisma/schema.prisma`

Adicionar ao schema (na seção de Reports):

```prisma
model MvRefreshLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String?  @map("tenant_id") @db.Uuid
  mvName      String   @map("mv_name") @db.VarChar(64)
  refreshedAt DateTime @default(now()) @map("refreshed_at") @db.Timestamptz()
  durationMs  Int      @map("duration_ms")
  status      String   @db.VarChar(16)

  @@index([mvName, refreshedAt])
  @@map("mv_refresh_log")
}
```

**Atenção:** `id` usa `dbgenerated` como fallback; o service DEVE usar `generateId()` (UUIDv7) ao criar registros. `@default(uuid())` é proibido no projeto.

- [x] Model `MvRefreshLog` adicionado ao `schema.prisma` com todos os campos e `@@map`

### 1.3 Executar `prisma generate` e validar compilação TypeScript `[C]`

```bash
pnpm --filter @metanoia/api exec prisma generate
pnpm --filter @metanoia/api exec tsc --noEmit
```

Ambos devem passar sem erros. `MvRefreshLog` deve aparecer no Prisma client gerado.

- [x] `prisma generate` sem erro
- [x] `tsc --noEmit` sem erro após geração do client

---

## FASE 2 — Job BullMQ `refresh-tenant-views`

### 2.1 Criar processor `refresh-tenant-views.processor.ts` `[C]`

**Arquivo:** `apps/api/src/reports/jobs/refresh-tenant-views.processor.ts`

Criar processor seguindo idiom do projeto (`presence-checkpoint.service.ts`):

- `@Injectable()` + `OnModuleInit`
- `createQueue(REPORTS_QUEUE_NAME)` + `createWorker(REPORTS_QUEUE_NAME, processor)`
- Enfileirar job repeatable em `onModuleInit`:
  ```typescript
  await this.queue.add('refresh-tenant-views', {}, {
    repeat: { pattern: '*/15 * * * *' },
    jobId: 'refresh-tenant-views-scheduler',
    attempts: 3,
    backoff: { type: 'custom' },
  });
  ```
- Implementar `backoffDelay(attemptsMade)`: delays `[30_000, 60_000, 120_000][attemptsMade - 1] ?? 120_000`
- Timeout: 10 minutos (600_000ms) — via `AbortController` ou `Promise.race` com timeout
- Lógica do processor:
  1. `correlationId = generateId()` — em TODOS os logs Pino desta execução
  2. `startedAt = Date.now()`
  3. `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_report` via `prisma.$executeRaw`
  4. `durationMs = Date.now() - startedAt`
  5. Se `durationMs > 300_000`: log Pino `{ level: 'warn', msg: 'mv_refresh_slow', durationMs, correlationId }`
  6. Gravar `mv_refresh_log`: `{ id: generateId(), mvName: 'mv_tenant_report', durationMs, status: 'success', tenantId: null }`
  7. Em catch: log Pino `{ level: 'error', msg: 'mv_refresh_failed', correlationId, durationMs }` + gravar `{ status: 'failed' }`
- `correlationId` em TODOS os logs (sem `console.log`)

- [x] Cron `*/15 * * * *` com `jobId` estável para idempotência do scheduler
- [x] Retry 3x com backoff 30s/60s/120s
- [x] Timeout 10min implementado
- [x] Alerta Pino `mv_refresh_slow` se `durationMs > 300_000`
- [x] Log Pino `mv_refresh_failed` após 3 falhas
- [x] `correlationId` (UUIDv7 via `generateId()`) em todos os logs
- [x] Grava `mv_refresh_log` em success e failed (`tenantId: null` — refresh global)

### 2.2 Registrar processor no `ReportsModule` `[A]`

**Arquivo:** `apps/api/src/reports/reports.module.ts`

Adicionar `RefreshTenantViewsProcessor`, `TenantReportService` e `TenantReportRefreshService` no array `providers`. Módulo já importa `BullMqModule`, `PrismaModule`, `RedisModule` — não duplicar imports.

- [x] `RefreshTenantViewsProcessor` registrado em `providers`
- [x] `TenantReportService` e `TenantReportRefreshService` registrados em `providers`

---

## FASE 3 — Service + Endpoints

### 3.1 Criar `TenantReportService` `[C]`

**Arquivo:** `apps/api/src/reports/tenant-report.service.ts`

**AC-SEC-01 (crítico — isolamento MV):** TODA query à `mv_tenant_report` DEVE incluir filtro explícito. A extensão Prisma não cobre MVs (não são tabelas Prisma mapeadas).

Método `getTenantSummary(query: TenantSummaryQuery)`:

1. Validar via `TenantSummaryQuerySchema.parse(query)` (inclui AC-SEC-06: range ≤ 365 dias)
2. **Período fixo (7d/30d/90d):** `prisma.$queryRaw` tagged-template com:
   ```sql
   WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
   -- E opcionalmente: AND group_id = ${groupId}::uuid  (AC-SEC-03: bind param)
   ```
3. **Período custom:** query ao vivo nas tabelas fonte com `startDate`/`endDate` como bind params `$queryRaw` — nunca interpolação string (AC-SEC-03)
4. **Semáforo por grupo (CL-03 — dec-011, lógica MAIORIA com floor amarelo):**
   - Verde: ≥ 50% participantes ativos com radar verde
   - Vermelho: ≥ 50% participantes ativos com radar vermelho
   - Amarelo: qualquer mistura (fallback)
5. **Filtro `status`:** aplicar após query (TypeScript) usando semáforo calculado
6. **`last_refresh_at`:** `SELECT MAX(refreshed_at) FROM mv_refresh_log WHERE mv_name = 'mv_tenant_report' AND status = 'success'` — **AC-SEC-02**: nunca `SELECT tenant_id`
7. **`stale`:** `lastRefreshAt < now() - 20min` ou `null` (CL-04 — dec-012)
8. **Agregação `TenantSummaryOverall`** calculada a partir dos grupos retornados
9. **`tenant_id` nunca no payload** retornado — AC-SEC-01
10. **BOLA prevention (AC-SEC-04):** `groupId` fora do tenant → resultado vazio, não 403
11. Todo o acesso à MV dentro de `withTenantTx` (padrão do projeto)

- [x] Filtro explícito `WHERE tenant_id = NULLIF(current_setting(...))::uuid` em toda leitura da MV
- [x] `$queryRaw` tagged-template para `groupId`/`startDate`/`endDate` — sem interpolação string (AC-SEC-03)
- [x] `last_refresh_at` sem `tenant_id` no SELECT (AC-SEC-02)
- [x] Semáforo MAIORIA com floor amarelo (CL-03)
- [x] `tenant_id` ausente do payload retornado (AC-SEC-01)
- [x] `groupId` de outro tenant → resultado vazio, não erro (AC-SEC-04)

### 3.2 Criar `TenantReportRefreshService` `[C]`

**Arquivo:** `apps/api/src/reports/tenant-report-refresh.service.ts`

Método `requestRefresh()`:

1. `tenantId` via `RequestContext.tenantId` exclusivamente (AC-02.5 — nunca parâmetro)
2. **Rate-limit atômico (AC-SEC-05):** `SET rate:tenant-report-refresh:{tenantId} 1 NX EX 300`
   - Retorna `null` se chave já existe → 429
   - Calcular `retryAfter` via `PTTL` em ms convertido para segundos
3. Se aceito: enfileirar `refresh-tenant-views` com `jobId = generateId()` em `queue:reports`
4. Gravar `mv_refresh_log` com `tenantId` (auditoria on-demand)
5. Retornar `{ accepted: true, jobId, estimatedRefreshAt: ISO 8601 + 15min }` → 202
6. Se bloqueado: retornar `{ accepted: false, jobId: null, retryAfter }` → 429

- [x] Rate-limit `SET NX EX 300` atômico — não GET-then-SET (AC-SEC-05)
- [x] `tenantId` exclusivamente via `RequestContext` (AC-02.5)
- [x] `generateId()` (UUIDv7) para `jobId`
- [x] `mv_refresh_log` gravado com `tenantId` no on-demand

### 3.3 Adicionar endpoints ao `reports.controller.ts` `[C]`

**Arquivo:** `apps/api/src/reports/reports.controller.ts`

Adicionar dois endpoints ao controller existente:

**GET `/api/v1/reports/tenant-summary`**
- `@Roles(Role.ADMIN_TENANT)` + `@UseGuards(RolesGuard)`
- `@Query()` com `ZodValidationPipe(TenantSummaryQuerySchema)` — padrão `~20 lines` do projeto
- Resposta `{ data: { groups, summary }, meta: { period, startDate, endDate, lastRefreshAt, stale, fromMaterializedView } }`
- **BOLA prevention:** NÃO aceitar `tenantId` como query param (AC-SEC-04; NFR-05)
- Swagger: `@ApiOperation`, `@ApiQuery`, `@ApiResponse(200/403)` — descrições em inglês

**POST `/api/v1/reports/tenant-summary/refresh`**
- `@Roles(Role.ADMIN_TENANT)` + `@UseGuards(RolesGuard)`
- Sem body
- 202: `{ data: { accepted: true, jobId }, meta: { retryAfter: null } }`
- 429: `{ data: { accepted: false, jobId: null }, meta: { retryAfter } }` + header `Retry-After: <s>`
- Swagger: `@ApiResponse(202/429/403)`

- [x] GET com guard `admin_tenant`, sem `tenantId` como query param (BOLA prevention)
- [x] POST com guard `admin_tenant`, resposta 202 e 429
- [x] Header `Retry-After` no 429
- [x] Swagger com descrições em inglês

---

## FASE 4 — Contratos Zod + Snapshot Tests

### 4.1 Criar `packages/types/src/reports/tenant-summary.ts` `[C]`

**Arquivo:** `packages/types/src/reports/tenant-summary.ts`

Implementar os 6+ schemas Zod 4 conforme data-model.md:

- `TenantSummaryPeriodSchema` = `z.enum(['7d','30d','90d','custom'])`
- `TenantSummaryQuerySchema` com 3 refinements: (a) custom exige startDate+endDate, (b) startDate < endDate, (c) range ≤ 365 dias (AC-SEC-06)
- `TenantGroupMetricsSchema`: `{ groupId(uuid), groupName, leaderName(nullable), attendanceAvgPercent(number|null), trailProgressAvgPercent, riskCount(int), activeParticipants(int), semaforo(z.enum(['verde','amarelo','vermelho'])) }`
- `TenantSummaryOverallSchema`: `{ totalGroups, totalLeaders, totalParticipants, overallAttendancePercent(nullable), overallTrailProgressPercent, totalRiskCount }`
- `TenantSummaryMetaSchema`: `{ period, startDate(ISO|null), endDate(ISO|null), lastRefreshAt(ISO|null), stale(bool), fromMaterializedView(bool) }`
- `TenantSummaryResponseSchema`: `{ data: { groups: TenantGroupMetrics[], summary: TenantSummaryOverall }, meta: TenantSummaryMeta }`
- `TenantRefreshResponseSchema`: `{ data: { accepted, jobId(string|null) }, meta: { retryAfter(number|null) } }`

**Regra do projeto:** todos os opcionais usam `.nullable().default(null)` (sem `undefined` em JSON).

- [x] Todos os 6 schemas exportados (Period, Query, GroupMetrics, Overall, Meta, Response + RefreshResponse)
- [x] 3 refinements em `TenantSummaryQuerySchema` (custom, ordem, range ≤ 365 dias)
- [x] `.nullable().default(null)` em todos os campos opcionais — sem `undefined`

### 4.2 Atualizar re-export em `packages/types/src/reports/index.ts` `[A]`

**Arquivo:** `packages/types/src/reports/index.ts`

Adicionar re-export sem sobrescrever exports existentes (`trail`, `meeting`, `leader`):

```typescript
export * from './tenant-summary';
```

Verificar antes: nenhum nome do prefixo `Tenant` conflita com exports existentes.

- [x] Re-export adicionado sem conflito com exports existentes

### 4.3 Snapshot tests dos schemas Zod `[C]`

**Arquivo:** `packages/types/src/reports/tenant-summary.spec.ts`

Testes Vitest com snapshot — gate contra breaking changes silenciosos:

```typescript
describe('TenantSummaryQuerySchema', () => {
  it('snapshot — shape estável', () => {
    expect(TenantSummaryQuerySchema.shape).toMatchSnapshot();
  });
  it('rejeita custom sem startDate', () => {
    expect(() => TenantSummaryQuerySchema.parse({ period: 'custom' })).toThrow();
  });
  it('rejeita range > 365 dias (AC-SEC-06)', () => {
    expect(() => TenantSummaryQuerySchema.parse({
      period: 'custom',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2026-02-01T00:00:00Z', // 397 dias
    })).toThrow();
  });
});
// Idem: TenantGroupMetricsSchema, TenantSummaryResponseSchema, TenantRefreshResponseSchema
```

Executar `pnpm --filter @metanoia/types test -- --run` para gerar snapshots iniciais e commitá-los.

- [x] Snapshot test para mínimo 4 schemas
- [x] Teste: `custom` sem `startDate` lança erro
- [x] Teste: range > 365 dias lança erro (AC-SEC-06)
- [x] Snapshots gerados e commitados no repositório

---

## FASE 5 — UI `/app/admin/reports/tenant-summary`

### 5.1 Criar `page.tsx` (Server Component shell) `[A]`

**Arquivo:** `apps/web/app/(authenticated)/admin/reports/tenant-summary/page.tsx`

Server Component com metadata e shell que importa o Client Component:

```typescript
import { TenantSummaryDashboard } from './_components/tenant-summary-dashboard';
export const metadata = { title: 'Relatório do Tenant' };
export default function TenantSummaryPage() {
  return <TenantSummaryDashboard />;
}
```

- [x] `page.tsx` Server Component no path correto `(authenticated)/admin/reports/tenant-summary/`

### 5.2 Criar `TenantSummaryDashboard` (Client Component principal) `[A]`

**Arquivo:** `apps/web/app/(authenticated)/admin/reports/tenant-summary/_components/tenant-summary-dashboard.tsx`

- `'use client'` + TanStack Query (`useQuery` com `refetchInterval: 30_000`) — polling AC-03.7
- Estado do botão via `useState` local (não Zustand — FR-06)
- Label "Dados atualizados em: {timestamp}" usando `lastRefreshAt` da meta (AC-03.1) — string em `pt-BR.json`
- **Banner stale (AC-03.5, AC-03.9):** quando `meta.stale = true`:
  ```tsx
  <div role="alert" aria-live="assertive">{/* mensagem pt-BR.json */}</div>
  ```
- Toasts com `aria-live="polite"` (AC-03.9)
- **NÃO adicionar** ao `a11y-pages.json` ou `a11y-checks.yml` — página autenticada

- [x] `'use client'` + `useQuery` com `refetchInterval: 30_000` (AC-03.7)
- [x] Label `lastRefreshAt` via `pt-BR.json` (AC-03.1)
- [x] Banner stale com `role="alert"` e `aria-live="assertive"` (AC-03.5, AC-03.9)
- [x] Estado local React para botão (sem Zustand)

### 5.3 Botão "Atualizar agora" com acessibilidade `[A]`

**Arquivo:** `apps/web/app/(authenticated)/admin/reports/tenant-summary/_components/refresh-button.tsx`

- `aria-busy={isRefreshing}` durante loading (AC-03.10)
- `disabled={isRefreshing}`
- Spinner visível durante loading (AC-03.2)
- 202 → toast PT-BR "Dados atualizados com sucesso" + `queryClient.invalidateQueries` (AC-03.4)
- 429 → toast PT-BR "Atualização disponível em X minutos" com `meta.retryAfter` (AC-03.3)
- Toast com `aria-live="polite"` (AC-03.9)
- Mensagens em `apps/web/messages/pt-BR.json` — sem string hardcoded

- [x] `aria-busy` no botão durante loading (AC-03.10)
- [x] Toast 202 com mensagem PT-BR (AC-03.4)
- [x] Toast 429 com `retryAfter` em PT-BR (AC-03.3)

### 5.4 Filtros com navegação por teclado `[A]`

**Arquivo:** `apps/web/app/(authenticated)/admin/reports/tenant-summary/_components/summary-filters.tsx`

- Reutilizar `FormField` de `packages/ui` (Epic 12, Story 12.5) — Tab/Enter/Escape sem armadilha de foco (AC-03.12)
- Filtros: período (7d/30d/90d/custom), grupo (select), status semáforo (verde/amarelo/vermelho)
- Campos `startDate`/`endDate` visíveis apenas quando `period=custom`
- Validação client-side via `TenantSummaryQuerySchema` antes de disparar query
- `text-secondary` para labels de contraste (AC-03.11)

- [x] `FormField` shadcn/ui em todos os filtros (AC-03.12)
- [x] Campos custom date visíveis apenas com `period=custom`
- [x] Sem armadilha de foco (Tab navega para fora do filtro)

### 5.5 Badges de semáforo acessíveis `[M]`

**Arquivo:** `apps/web/app/(authenticated)/admin/reports/tenant-summary/_components/semaforo-badge.tsx`

- Ícone + texto (não depender apenas de cor — WCAG AA, AC-03.8)
- `aria-label="Status: Verde"` / `"Amarelo"` / `"Vermelho"` (AC-03.8)
- Contraste mínimo 4.5:1: verde `#16a34a`, amarelo `#ca8a04`, vermelho `#dc2626`

- [x] Badge com ícone + texto + `aria-label` (AC-03.8)
- [x] Contraste WCAG AA verificado (não apenas cor)

### 5.6 Mensagens PT-BR em `pt-BR.json` `[M]`

**Arquivo:** `apps/web/messages/pt-BR.json`

Adicionar chaves para todas as mensagens user-facing:

```json
{
  "reports": {
    "tenantSummary": {
      "lastRefreshedAt": "Dados atualizados em: {timestamp}",
      "refreshSuccess": "Dados atualizados com sucesso",
      "refreshRateLimited": "Atualização disponível em {minutes} minutos",
      "staleWarning": "Dados podem estar desatualizados",
      "refreshButton": "Atualizar agora"
    }
  }
}
```

- [x] Todas as mensagens user-facing centralizadas em `pt-BR.json` — sem string hardcoded

### 5.7 Testes axe-core nos componentes UI `[A]`

**Arquivo:** `apps/web/app/(authenticated)/admin/reports/tenant-summary/_components/tenant-summary-dashboard.spec.tsx`

- `render(<TenantSummaryDashboard />)` (mock de query) + `expect(await axe(container)).toHaveNoViolations()`
- Testar badge semáforo: `aria-label` presente
- Testar banner stale: `role="alert"` + `aria-live="assertive"` no DOM
- Testar botão Atualizar: `aria-busy` durante loading
- Testar filtros: ausência de armadilha de foco

- [x] axe-core no `TenantSummaryDashboard` (sem violações)
- [x] Teste `aria-live` no banner stale
- [x] Teste `aria-busy` no botão
- [x] Teste ausência de armadilha de foco nos filtros

---

## FASE 6 — Teste RLS (Gate Obrigatório de Merge)

### 6.1 Criar `mv-tenant-report.rls-spec.ts` `[C]`

**Arquivo:** `apps/api/test/rls/mv-tenant-report.rls-spec.ts`

Teste de isolamento multi-tenant na MV — Admin Tenant A **NÃO VÊ** dados do Tenant B.

```typescript
describe('MV mv_tenant_report — RLS isolation', () => {
  it('Admin Tenant A NÃO vê grupos do Tenant B na MV (AC-SEC-01)', async () => {
    // setup: criar tenantA e tenantB com grupos e participantes distintos
    // popular MV via: await prisma.$executeRaw`REFRESH MATERIALIZED VIEW mv_tenant_report`
    await withTenantTx(prisma, { tenantId: tenantAId }, async (tx) => {
      const rows = await tx.$queryRaw`
        SELECT group_id FROM mv_tenant_report
        WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      `;
      expect(rows.every((r: any) => r.group_id !== tenantBGroupId)).toBe(true);
    });
  });

  it('current_setting vazio → 0 linhas (closed-by-default)', async () => {
    // sem withTenantTx — current_setting('app.current_tenant_id') = ''
    const rows = await prisma.$queryRaw`
      SELECT * FROM mv_tenant_report
      WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    `;
    expect(rows).toHaveLength(0);
  });

  it('Admin Tenant B vê APENAS seus grupos', async () => {
    await withTenantTx(prisma, { tenantId: tenantBId }, async (tx) => {
      const rows = await tx.$queryRaw`
        SELECT tenant_id FROM mv_tenant_report
        WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      `;
      expect(rows.every((r: any) => r.tenant_id === tenantBId)).toBe(true);
    });
  });
});
```

**Gate:** Este teste é pré-requisito de merge (CL-01 — dec-009 score 3; constitution multi-tenancy ABSOLUTO).

- [x] Teste: Tenant A não vê dados do Tenant B (AC-SEC-01)
- [x] Teste: `current_setting` vazio → 0 linhas (closed-by-default)
- [x] Teste: Tenant B vê apenas seus próprios grupos
- [x] Teste passa com `docker-compose.test.yml` (PostgreSQL real)

---

## FASE 7 — Revisão Final, Gate e PR

### 7.1 Executar suite de testes completa `[C]`

```bash
pnpm --filter @metanoia/api test -- --run
pnpm --filter @metanoia/types test -- --run
pnpm --filter @metanoia/web test -- --run
```

Focos críticos: `mv-tenant-report.rls-spec.ts` (gate), `tenant-summary.spec.ts` (snapshots), axe-core UI.

- [ ] Suite `@metanoia/api` passa (incluindo `mv-tenant-report.rls-spec.ts`)
- [ ] Suite `@metanoia/types` passa (incluindo snapshots)
- [ ] Suite `@metanoia/web` passa (incluindo axe-core)

### 7.2 Lint e build Turborepo `[A]`

```bash
pnpm lint
pnpm build
```

- [ ] `pnpm lint` sem erros
- [ ] `pnpm build` Turborepo sem erros

### 7.3 Checklist de segurança AC-SEC-01..06 `[C]`

Review manual obrigatório antes do PR:

| AC | Verificação |
|----|-------------|
| AC-SEC-01 | Toda leitura de `mv_tenant_report` usa `WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` dentro de `withTenantTx` |
| AC-SEC-02 | `last_refresh_at` = `SELECT MAX(refreshed_at) FROM mv_refresh_log WHERE mv_name='mv_tenant_report' AND status='success'` — sem `tenant_id` no SELECT |
| AC-SEC-03 | `groupId`, `startDate`, `endDate` como bind params via `$queryRaw` tagged-template — sem interpolação string |
| AC-SEC-04 | `groupId` de outro tenant → resultado vazio, não 403 |
| AC-SEC-05 | Rate-limit via `SET key val NX EX 300` atômico — não GET-then-SET |
| AC-SEC-06 | `TenantSummaryQuerySchema` refinement rejeita range > 365 dias |

- [ ] AC-SEC-01..06 verificados e confirmados manualmente

### 7.4 Abrir PR `[A]`

- Branch: `feat/relatorio-tenant-mv`
- PR description: referência FR65 / Story 13.2b, ACs de segurança AC-SEC-01..06, link ao `mv-tenant-report.rls-spec.ts`
- CI: lint + test + build (Turborepo remote cache)
- Teste RLS obrigatório no CI com PostgreSQL real (`docker-compose.test.yml`)

- [ ] PR aberto com referência à story FR65 / Story 13.2b
- [ ] CI verde (lint + test + build)
- [ ] Teste RLS `mv-tenant-report.rls-spec.ts` verde no CI

---

## Resumo Quantitativo

| FASE | Tasks | `[C]` | `[A]` | `[M]` | Desbloqueado por |
|------|-------|-------|-------|-------|-----------------|
| 1 — Migration | 1.1, 1.2, 1.3 | 3 | 0 | 0 | — (base) |
| 2 — BullMQ Job | 2.1, 2.2 | 1 | 1 | 0 | FASE 1 |
| 3 — Service + Endpoints | 3.1, 3.2, 3.3 | 3 | 0 | 0 | FASE 1 |
| 4 — Zod + Types | 4.1, 4.2, 4.3 | 2 | 1 | 0 | FASE 3 (contratos) |
| 5 — UI | 5.1..5.7 | 0 | 4 | 2 | FASE 3 + FASE 4 |
| 6 — Testes RLS | 6.1 | 1 | 0 | 0 | FASE 1 + FASE 3 |
| 7 — Revisão Final | 7.1..7.4 | 2 | 2 | 0 | Todas |
| **Total** | **17 tasks** | **12** | **8** | **2** | |

**Checkboxes totais:** ~55 itens de verificação
**Gate de merge obrigatório:** `mv-tenant-report.rls-spec.ts` (FASE 6.1) + AC-SEC-01..06 (FASE 7.3)
