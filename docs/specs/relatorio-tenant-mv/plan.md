# Plano de Implementação — Relatório por Tenant com Materialized Views (FR65 / Story 13.2b)

## Summary

Relatório agregado por tenant (admin_tenant) construído sobre uma **Materialized
View** PostgreSQL (`mv_tenant_report`) refrescada a cada 15 min por um job BullMQ
repetível em `queue:reports`. A MV pré-computa, por grupo, métricas dos períodos
fixos 7d/30d/90d (média de presença e progresso médio de trilha) e a contagem de
participantes em risco; o service agrega o nível tenant-wide em memória. Período
`custom` faz query ao vivo (sem MV) com aviso.

**Decisão arquitetural central (dec-009, score 3):** PostgreSQL **não aplica RLS
em Materialized Views**. O isolamento multi-tenant — princípio MUST da constitution
(I. Multi-tenancy Absoluto) — é garantido por **filtro explícito de `tenant_id` no
service** (Opção A): a query roda dentro de `withTenantTx`, que faz `SET LOCAL
app.current_tenant_id = '<uuid>'`, e o `WHERE tenant_id = NULLIF(current_setting(
'app.current_tenant_id', true), '')::uuid` referencia o mesmo session var. Defesa em
profundidade: a MV carrega a coluna `tenant_id` (nunca exposta na resposta) e um teste
RLS obrigatório (`mv-tenant-report.rls-spec.ts`) prova que admin do tenant A não vê
dados do tenant B.

Estende `apps/api/src/reports/` (NÃO cria módulo novo). Analytics é supporting
subdomain → service direto com Prisma (sem repository pattern). Padrão de resposta
herda de `getLeaderSummary()`.

## Technical Context

- **Stack:** NestJS 11 (REST `/api/v1`), Prisma v7 + PrismaPg adapter, PostgreSQL
  (MV + RLS), Redis (rate-limit), BullMQ (`queue:reports`), Pino (logs estruturados),
  Zod 4 em `packages/types`, Next.js 16 (App Router, CSR autenticado), TanStack Query.
- **Multi-tenant:** `tenant_id` via `AsyncLocalStorage` (`RequestContext`), nunca
  parâmetro. Tenant chega na SQL via `withTenantTx` → `SET LOCAL app.current_tenant_id`.
- **IDs:** UUIDv7 via `generateId()` (`@metanoia/types`); jamais `@default(uuid())`.
- **Datas:** ISO 8601 string nas respostas; nulls explícitos (`.nullable().default(null)`).
- **Migration:** SQL bruto manual (`migration.sql`) — Prisma não modela MV nativamente.
  A tabela auxiliar `mv_refresh_log` É modelada no `schema.prisma` (Prisma normal).
- **Performance alvo (NFR-02):** consulta `tenant-summary` < 2s para 500 tenants ×
  10 grupos × 50 participantes (250k participantes). A MV pré-agrega; a query final
  lê N linhas (1 por grupo do tenant) — barata.

## Constitution Check

| Princípio | Aderência |
|-----------|-----------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | MV carrega `tenant_id`; filtro explícito + `SET LOCAL`; teste RLS obrigatório. `mv_refresh_log` tem RLS policy padrão (tabela normal). |
| II. Type-Safety & IDs determinísticos | `mv_refresh_log.id` via `generateId()` (UUIDv7); Zod compartilhado; sem `undefined` em JSON. |
| III. Idioma & Vocabulário Pastoral | Código/logs em EN; UI PT-BR (banner "Dados podem estar desatualizados", toasts). Termos pastorais nos rótulos de saúde. |
| IV. Contratos de API Padronizados | `{ data, meta }`; `last_refresh_at` em `meta`; 202 (refresh aceito), 429 (rate-limit + `retryAfter`). |
| V. Separação de Estado no Frontend | TanStack Query (server state) na página CSR autenticada; sem Zustand para dados do relatório. |
| VI. Qualidade Verificável | Unit + integration + RLS spec (policy/MV nova → obrigatório); snapshot dos schemas Zod; WCAG AA (banner/toasts `aria-live`, badges semáforo ícone+texto); CI verde antes de done. |

Re-check pós Phase 1: ver seção dedicada abaixo.

## Project Structure

### Documentação (feature dir)
```
docs/specs/relatorio-tenant-mv/
├── spec.md          (existente — Clarified, dec-009..dec-013)
├── plan.md          (este arquivo)
├── research.md      (decisões técnicas + sondas empíricas)
├── data-model.md    (MV + mv_refresh_log + entidades reusadas)
├── contracts/
│   ├── tenant-summary.md         (GET /api/v1/reports/tenant-summary)
│   └── tenant-summary-refresh.md (POST .../refresh)
└── quickstart.md    (validação manual fim-a-fim)
```

### Código-fonte (árvore REAL — pontos de toque)
```
apps/api/
├── prisma/
│   ├── schema.prisma                         # + model MvRefreshLog (Prisma normal, com RLS)
│   └── migrations/
│       └── YYYYMMDD_add_mv_tenant_report/
│           └── migration.sql                 # CREATE MATERIALIZED VIEW + UNIQUE INDEX + mv_refresh_log table + RLS
├── src/reports/
│   ├── reports.module.ts                     # registra TenantReportService + RefreshTenantViewsProcessor
│   ├── reports.controller.ts                 # + GET tenant-summary, POST tenant-summary/refresh
│   ├── tenant-report.service.ts              # NOVO — query MV (períodos fixos) / query ao vivo (custom) + agregação tenant-wide + semáforo MAIORIA
│   ├── tenant-report-refresh.service.ts      # NOVO — rate-limit Redis (1/5min/tenant) + enqueue job
│   └── jobs/
│       └── refresh-tenant-views.processor.ts # NOVO — repeatable 15min, REFRESH ... CONCURRENTLY, retry/backoff, timeout, alerta Pino, mv_refresh_log write
├── test/rls/
│   └── mv-tenant-report.rls-spec.ts          # NOVO — tenant A não vê tenant B na MV
packages/types/src/reports/
├── tenant-summary.ts                         # NOVO — schemas Zod (query/response/refresh)
└── index.ts                                  # + re-export (não sobrescrever exports trail/meeting/leader)
apps/web/app/(authenticated)/admin/reports/tenant-summary/
└── page.tsx                                  # NOVO — UI CSR; banner stale, botão Atualizar, filtros, badges semáforo
```

## Convenções de Borda

- **MV não passa por RLS automático.** Toda leitura da MV roda dentro de
  `withTenantTx(prisma, fn)` e adiciona `WHERE tenant_id = NULLIF(current_setting(
  'app.current_tenant_id', true), '')::uuid` explicitamente. Nunca ler a MV via
  `prisma.client` cru sem o filtro.
- **`REFRESH ... CONCURRENTLY` exige UNIQUE INDEX** na MV → índice único em
  `(tenant_id, group_id)`. Sem ele, o CONCURRENTLY falha.
- **`last_refresh_at`** vem de `mv_refresh_log` (última linha `status='success'`
  para `mv_name='mv_tenant_report'`) — fonte canônica (dec-010), NÃO de metadado da MV.
- **Stale banner (dec-012):** `now() - last_refresh_at > 20min` → `stale: true` no
  `meta`; UI mostra banner. Threshold fixo 20min.
- **Período (dec-013):** `7d|30d|90d` → lê colunas pré-computadas da MV. `custom` →
  query ao vivo (Meeting/MeetingAttendance/TrailProgress no range), `meta.fromMaterializedView=false`.
- **Semáforo agregado por grupo (dec-011):** lógica MAIORIA do status dos participantes;
  **floor amarelo** quando `risk_count > 0` (nunca verde se há risco).
- **Rate-limit refresh:** chave Redis `rate:tenant-report-refresh:{tenantId}` TTL 300s;
  excedido → 429 + `retryAfter` (segundos restantes). Aceito → 202.
- **Job repeatable:** padrão `repeat: { every }` (ver `presence-checkpoint.service.ts`)
  ou `repeat: { pattern: '*/15 * * * *' }`; `jobId` estável para idempotência.
  Worker registrado em `onModuleInit` via `BullMqService.createWorker`.
- **Resposta:** `{ data: { groups: [...], summary: {...} }, meta: { period, last_refresh_at, stale, fromMaterializedView } }`.
  Sem `undefined`; opcionais `.nullable().default(null)`.

## Decisões de Plano (resumo — detalhe em research.md)

- **dec-009 (herdada, score 3):** RLS-em-MV Opção A — filtro explícito de `tenant_id`
  no service dentro de `withTenantTx`. MV inclui coluna `tenant_id` + UNIQUE INDEX.
- **dec-010 (herdada, score 2):** `last_refresh_at` em tabela Prisma `mv_refresh_log`.
- **dec-011 (herdada, score 2):** semáforo agregado = MAIORIA + floor amarelo se risco.
- **dec-012 (herdada, score 3):** stale threshold 20min.
- **dec-013 (herdada, score 2):** colunas de período fixo na MV; custom = query ao vivo.
- **Plano P-01 (score 3, sonda):** schema `presence-checkpoint.service.ts` usa
  `repeat: { every }` → o job repeatable segue esse idiom (não há `@nestjs/schedule`/Cron
  no projeto; o cron é do BullMQ). Evidência: `grep` retornou apenas presence-checkpoint.
- **Plano P-02 (score 3, sonda):** campos exatos confirmados contra `schema.prisma` —
  `Meeting.scheduledFor`/`status`, `MeetingAttendance.presenceType`/`totalDurationSeconds`,
  `TrailProgress.progressPercent`/`completedAt`, `GroupMember.role`/`deletedAt`,
  `ParticipantRadarStatus.participantId`/`status`.
- **Plano P-03 (score 3, sonda):** RLS form canônica do projeto é
  `tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`
  (migration `20260510210000_consolidate_rls_nullif`). A MV usa essa mesma expressão
  no filtro do service e a tabela `mv_refresh_log` ganha policy `tenant_isolation`.

## Riscos & Mitigações

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| **Leitura cross-tenant na MV** (filtro `tenant_id` esquecido/falho) | CRÍTICO | Filtro obrigatório dentro de `withTenantTx`; teste RLS dedicado; revisão de que NENHUM caminho lê a MV sem `WHERE tenant_id`. Coluna `tenant_id` nunca no payload. Ver Gate de Segurança. |
| `REFRESH CONCURRENTLY` sem UNIQUE INDEX → erro | ALTO | UNIQUE INDEX `(tenant_id, group_id)` na migration; teste de integração refresca a MV. |
| Refresh lento (>5min) bloqueando dados frescos | MÉDIO | `CONCURRENTLY` não bloqueia leituras; alerta Pino `mv_refresh_slow` >5min; timeout 10min; dados stale servidos com banner. |
| Race no rate-limit (refresh concorrente) | MÉDIO | `SET NX` Redis com TTL atômico; 429 + `retryAfter`. |
| Período custom ao vivo lento em tenant grande | MÉDIO | Documentar como caminho degradado; índices existentes `(tenant_id, scheduledFor)`; custom é exceção. |
| `current_setting` vazio (pré-tenant) lê MV inteira | ALTO | Form NULLIF → cast NULL → `WHERE` NULL → 0 linhas (closed-by-default), igual às policies RLS do projeto. |

## Gate de Segurança (owasp-security) — resultado

Gate executado nesta onda (foco: isolamento de tenant na MV). **0 CRITICAL.**
3 HIGH mitigados-no-escopo + 3 MÉDIO/LOW. Como a constitution faz isolamento de
tenant um MUST, os HIGH viram **acceptance criteria obrigatórios** (não escalam —
paridade com relatorio-reuniao block-001: vuln cross-tenant é corrigida no escopo).

| ID | Sev | OWASP | Achado | Resolução (acceptance criterion) |
|----|-----|-------|--------|----------------------------------|
| F-01 | HIGH | A01/API1 | Leitura cross-tenant na MV (sem RLS nativo) | **AC-SEC-01:** TODA leitura da MV roda dentro de `withTenantTx` COM `WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`. Proibido ler a MV via `prisma.client` cru sem o filtro. Teste `mv-tenant-report.rls-spec.ts` obrigatorio (tenant A nao ve B). Coluna `tenant_id` nunca no payload. |
| F-02 | HIGH | A01 | `mv_refresh_log` (global) vazar `tenant_id` de outro tenant | **AC-SEC-02:** `last_refresh_at` = `SELECT max(refreshed_at) ... WHERE mv_name='mv_tenant_report' AND status='success'` — seleciona SOMENTE `refreshed_at` (nunca `tenant_id`). |
| F-03 | HIGH | A05/A03 (CWE-89) | SQL injection no path raw da MV e na query custom ao vivo | **AC-SEC-03:** usar `$queryRaw` tagged-template (ou bind params) para `groupId`/`startDate`/`endDate`; so o texto SQL e literal. `tenant_id` vem de `current_setting` (nunca interpolado). |
| F-04 | MEDIO | API1 | BOLA no filtro `groupId` | **AC-SEC-04:** `groupId` fora do tenant -> resultado vazio (RLS-equivalente), NAO 403/leak. Padrao herdado de leader-summary. |
| F-05 | MEDIO | API4 | Race no rate-limit do refresh (TOCTOU) | **AC-SEC-05:** rate-limit via `SET key val NX EX 300` atomico (nao GET-then-SET). |
| F-06 | LOW | API4 | Range custom ilimitado (resource consumption) | **AC-SEC-06:** Zod refinement limita o range custom (ex. <= 1 ano). |

Status: nenhum bloqueio humano emitido — todos os HIGH cobertos por design + ACs
obrigatorios acima (constitution-compliant). Segue o pipeline.

## Re-check de Constitution (pós Phase 1)

Nenhuma violação introduzida: `tenant_id` nunca é parâmetro (via AsyncLocalStorage);
UUIDv7 em `mv_refresh_log`; resposta `{data, meta}`; RLS spec obrigatório presente;
WCAG AA no UI. A MV é a única estrutura sem RLS nativo — compensada por filtro
explícito + teste (Princípio I mantido por design).

## Próximos passos (pipeline)

checklist → create-tasks → execute-task (loop) → review-task.
