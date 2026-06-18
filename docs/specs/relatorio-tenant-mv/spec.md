# Feature Spec: Relatório por Tenant com Materialized Views (FR65)

## Sumário

**Story:** 13.2b — Relatório por Tenant com Materialized Views
**Epic:** 13 — Relatórios Avançados & Analytics
**FR:** FR65
**Status:** ready-for-dev (post-specify)
**Contexto:** Story 13.2a (Relatório por Líder) entregue e integrada em `apps/api/src/reports/`. Esta feature estende o mesmo módulo com MV para o Admin Tenant.

### Objetivo

Como Admin Tenant, quero métricas agregadas de todo o tenant servidas por Materialized View, para monitorar saúde geral da comunidade e tomar decisões estratégicas pastorais.

### Pré-requisitos confirmados

| Dependência | Status |
|---|---|
| Epic 5 — Reuniões (dados de presença) | Requerido (dados fonte) |
| Epic 7 — Pastoral Radar (semáforo) | Requerido (riskCount na MV) |
| Epic 8 — Trilhas (progresso) | Requerido (trail_progress na MV) |
| Story 13.1 — Relatório por Reunião | Entregue — padrões reutilizáveis |
| Story 13.2a — Relatório por Líder | Entregue — padrões reutilizáveis, mesma queue |
| BullMQ + Redis em `apps/api/src/` | Operacional |
| `packages/types` — Zod compartilhado | Operacional |

### Limites de escopo

**IN:** `mv_tenant_report`, job `refresh-tenant-views`, `GET /api/v1/reports/tenant-summary`, `POST /api/v1/reports/tenant-summary/refresh`, UI `/app/admin/reports/tenant-summary`, testes RLS.

**OUT:** `mv_platform_metrics` e job `refresh-platform-views` (Story 13.4 — Super Admin). Este scope NAO implementa o child job BullMQ parent/child flow para plataforma.

---

## Risco Critico: RLS em Materialized View

> **ESTE RISCO DEVE SER RESOLVIDO NO CLARIFY/PLAN ANTES DE QUALQUER IMPLEMENTACAO.**

**Problema:** PostgreSQL NAO aplica Row-Level Security (RLS) automaticamente em consultas a Materialized Views. Uma MV e uma tabela fisica; quando um Admin Tenant do tenant A consulta `mv_tenant_report`, o PostgreSQL executa `SELECT ... FROM mv_tenant_report` sem aplicar as policies de RLS definidas nas tabelas fonte.

**Impacto:** Sem mitigacao, um Admin Tenant poderia ver metricas de grupos de outros tenants — violacao critica da regra absoluta de multi-tenancy do projeto.

**Opcoes de mitigacao (a decidir no plan):**

| Opcao | Descricao | Pros | Contras |
|---|---|---|---|
| A — WHERE filtro explicito | Service aplica `WHERE tenant_id = getRequestContext().tenantId` em todo query a MV | Simples, sem DDL extra | Depende de nao esquecer o filtro; BOLA se endpoint nao filtrar |
| B — Security-barrier view wrapper | Criar `VIEW tenant_summary_secure WITH (security_barrier=true) AS SELECT ... FROM mv_tenant_report WHERE tenant_id = current_setting(...)` | Enforce no DB, transparente ao service | Requer SET LOCAL por request; complexidade DDL |
| C — MV por tenant (sharding) | Uma MV por tenant_id | RLS nativa por objeto | Inviavel com 500+ tenants |
| D — RLS na propria MV | `ALTER TABLE mv_tenant_report ENABLE ROW LEVEL SECURITY` | Familiar ao padrao do projeto | Requer current_setting configurado por request |

**Recomendacao preliminar:** Opcao A (filtro explicito no service, padrao AsyncLocalStorage) + teste RLS isolation obrigatorio em `apps/api/test/rls/`. O Prisma extension ja injeta tenantId em queries de tabelas normais, mas MV requer tratamento explicito pois nao e uma tabela Prisma mapeada.

**Gate:** Teste RLS isolation em `apps/api/test/rls/mv-tenant-report.rls-spec.ts` — admin do tenant A NAO deve ver dados do tenant B — e obrigatorio antes de merge.

---

## User Stories

### US-01: Metricas agregadas do tenant via MV

```
Como Admin Tenant
Quero acessar GET /api/v1/reports/tenant-summary?period=30d
Para visualizar metricas consolidadas de todos os grupos do tenant
```

**Criterios de aceitacao:**

- AC-01.1: A resposta inclui, por grupo: `groupId`, `groupName`, `leaderName`, `avgAttendancePercent`, `avgTrailProgressPercent`, `riskCount`, `activeParticipantsCount`
- AC-01.2: A resposta inclui sumario tenant-wide: `totalGroups`, `totalLeaders`, `totalParticipants`, `overallAttendancePercent`, `overallTrailCompletionPercent`
- AC-01.3: Os dados vem da MV `mv_tenant_report` (nao de queries ao vivo)
- AC-01.4: A meta inclui `lastRefreshAt` (ISO 8601) refletindo o ultimo `REFRESH MATERIALIZED VIEW CONCURRENTLY` bem-sucedido
- AC-01.5: Guard `@Roles('admin_tenant')` obrigatorio — lider recebe 403
- AC-01.6: O filtro `?period=30d` e suportado; tambem `7d`, `90d`, `custom` com `startDate` e `endDate`
- AC-01.7: O filtro `?groupId=<uuid>` retorna metricas somente do grupo especificado
- AC-01.8: O filtro `?semaforo=verde|amarelo|vermelho` filtra grupos por status predominante

**Formato de resposta (contrato):**

```json
{
  "data": {
    "groups": [
      {
        "groupId": "uuid-v7",
        "groupName": "string",
        "leaderName": "string",
        "avgAttendancePercent": 85.5,
        "avgTrailProgressPercent": 60.0,
        "riskCount": 2,
        "activeParticipantsCount": 18,
        "semaforo": "verde"
      }
    ],
    "summary": {
      "totalGroups": 5,
      "totalLeaders": 4,
      "totalParticipants": 92,
      "overallAttendancePercent": 78.3,
      "overallTrailCompletionPercent": 55.0
    }
  },
  "meta": {
    "lastRefreshAt": "2026-06-17T23:00:00Z",
    "period": "30d",
    "tenantId": "uuid-v7"
  }
}
```

---

### US-02: Atualizacao sob demanda com rate-limit

```
Como Admin Tenant
Quero acionar POST /api/v1/reports/tenant-summary/refresh
Para forcar atualizacao imediata dos dados fora do ciclo de 15min
```

**Criterios de aceitacao:**

- AC-02.1: O endpoint dispara o job BullMQ `refresh-tenant-views` na fila `queue:reports`
- AC-02.2: Retorna HTTP 202 com `{ "data": { "jobId": "<uuid>", "estimatedRefreshAt": "<ISO 8601>" } }`
- AC-02.3: Rate limit: maximo 1 requisicao por 5 minutos por tenant (chave Redis `rate:reports:tenant-refresh:<tenantId>`)
- AC-02.4: Se rate-limited, retorna HTTP 429 com `{ "statusCode": 429, "error": "Too Many Requests", "message": "Atualizacao disponivel em X minutos", "details": { "retryAfter": <segundos> } }`
- AC-02.5: O tenant_id vem exclusivamente de `RequestContext` (AsyncLocalStorage) — nunca de parametro
- AC-02.6: Guard `@Roles('admin_tenant')` obrigatorio

---

### US-03: Dashboard web de saude do tenant

```
Como Admin Tenant
Quero visualizar /app/admin/reports/tenant-summary
Para monitorar a saude geral da comunidade com filtros e alertas visuais
```

**Criterios de aceitacao:**

- AC-03.1: A pagina exibe label "Dados atualizados em: {timestamp}" com `lastRefreshAt` da meta
- AC-03.2: Botao "Atualizar agora" aciona o endpoint POST; durante a operacao mostra spinner e fica desabilitado
- AC-03.3: Se rate-limited (429), exibe toast: "Atualizacao disponivel em X minutos"
- AC-03.4: Na conclusao bem-sucedida, exibe toast: "Dados atualizados com sucesso" e atualiza o timestamp
- AC-03.5: Se o job falhar (dados stale), exibe banner: "Dados podem estar desatualizados"
- AC-03.6: Filtros disponiveis: periodo (7d/30d/90d/custom), grupo especifico, status semaforo (verde/amarelo/vermelho)
- AC-03.7: TanStack Query com polling para atualizacao automatica do status de refresh
- AC-03.8: Badges de semaforo com icone + texto (ex: "verde" com aria-label) — WCAG AA para contraste
- AC-03.9: Banner stale com `role="alert"` + `aria-live="assertive"`; toasts com `aria-live="polite"`
- AC-03.10: Botao "Atualizar agora" com `aria-busy` durante carregamento
- AC-03.11: Reutilizar `FormField` (Epic 12, Story 12.5) e `text-secondary` para contraste acessivel

---

## Requisitos Funcionais

### FR-01: Materialized View `mv_tenant_report`

| Campo | Tipo | Origem |
|---|---|---|
| `tenant_id` | UUID | Obrigatorio — isolamento multi-tenant |
| `group_id` | UUID | PK composta com tenant_id |
| `group_name` | text | tabela `groups` |
| `leader_name` | text | tabela `users` (via group_members role=lider) |
| `avg_attendance_percent` | numeric(5,2) | agrega meeting_attendances / meetings |
| `avg_trail_progress_percent` | numeric(5,2) | agrega trail_progress dos membros |
| `risk_count` | int | conta participant_status em risco (semaforo vermelho/amarelo) |
| `active_participants_count` | int | membros ativos no periodo |

- UNIQUE INDEX em `(tenant_id, group_id)` — obrigatorio para `REFRESH CONCURRENTLY`
- Tabela auxiliar `mv_refresh_log` com colunas `mv_name`, `refreshed_at`, `duration_ms`; mantem o `last_refresh_at`
- Migration via `prisma migrate` com SQL raw em `YYYYMMDD_add_mv_tenant_report`

### FR-02: Job BullMQ `refresh-tenant-views`

- Fila: `queue:reports`; nome do job: `refresh-tenant-views`
- Cron: `*/15 * * * *` (a cada 15min)
- Executa `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_report`
- Timeout por execucao: 10 minutos
- Retry: 3 tentativas com backoff exponencial — delays 30s / 60s / 120s
- Se duracao > 5min: emite alerta via Pino `{ level: 'warn', msg: 'mv_refresh_slow', durationMs, correlationId }`
- Falha apos 3 tentativas: log `{ level: 'error', msg: 'mv_refresh_failed', correlationId }` — dados stale servidos normalmente
- Processor: `apps/api/src/reports/jobs/refresh-tenant-views.processor.ts`
- **Escopo:** Apenas `mv_tenant_report`. O job `refresh-platform-views` (Story 13.4) NAO e child deste job nesta story

### FR-03: Endpoint GET /api/v1/reports/tenant-summary

- Guard: `@Roles('admin_tenant')` via `KeycloakAuthGuard` + `RolesGuard` + `TenantGuard`
- Tenant isolamento: `WHERE tenant_id = getRequestContext().tenantId` explicito no query a MV
- Suporte a query params: `period` (7d|30d|90d|custom), `startDate`, `endDate`, `groupId`, `semaforo`
- Validacao: `TenantSummaryQuerySchema` (Zod, em `packages/types`)
- Resposta: `{ data: { groups: [...], summary: {...} }, meta: { lastRefreshAt, period, tenantId } }`
- Strings user-facing em PT-BR; campos tecnicos em ingles
- Performance: query na MV deve completar em menos de 2s com 500 tenants x 10 grupos x 50 participantes

### FR-04: Endpoint POST /api/v1/reports/tenant-summary/refresh

- Guard: `@Roles('admin_tenant')`
- Rate limit Redis: chave `rate:reports:tenant-refresh:<tenantId>`, TTL 300s, max 1 por janela
- 429: `{ statusCode: 429, error: "Too Many Requests", message: "...", details: { retryAfter: <segundos> } }`
- 202: `{ data: { jobId: "<uuid>", estimatedRefreshAt: "<ISO 8601 + 15min>" } }`
- Tenant id via `getRequestContext()` exclusivamente

### FR-05: Schemas Zod em `packages/types`

- `TenantGroupMetricsSchema` — metricas por grupo
- `TenantSummaryResponseSchema` — envelope data + meta
- `TenantSummaryQuerySchema` — query params validados
- `TenantRefreshResponseSchema` — resposta 202
- Snapshot tests obrigatorios para cada schema (gate contra breaking changes silenciosos)

### FR-06: UI `/app/admin/reports/tenant-summary`

- Server Component (layout + shell) + Client Components (filtros, botao, toasts) — padrao App Router
- TanStack Query: somente em Client Components, com polling para status de refresh
- Zustand: NAO introduzir novo store — usar estado local React para o botao
- Mensagens user-facing em PT-BR centralizadas em `apps/web/messages/pt-BR.json`

---

## Requisitos Nao-Funcionais

### NFR-01: Isolamento multi-tenant (ABSOLUTO)

- Toda query a `mv_tenant_report` deve incluir filtro `tenant_id = <tenant-do-contexto>`
- Teste RLS isolation em `apps/api/test/rls/mv-tenant-report.rls-spec.ts` e OBRIGATORIO para merge
- Contexto via `AsyncLocalStorage` (nunca parametro de funcao)

### NFR-02: Performance

- Query `GET /api/v1/reports/tenant-summary` menor que 2s em carga padrao (250k participantes)
- Justificativa da MV: evitar query ao vivo que varreria todos os `meeting_attendances` e `trail_progress` de um tenant a cada requisicao

### NFR-03: Observabilidade

- Job `refresh-tenant-views`: logs Pino com `correlationId` em toda operacao (inicio, conclusao, falha, slow)
- `lastRefreshAt` persistido em `mv_refresh_log` e retornado em meta de toda resposta do GET
- Banner stale visivel quando `lastRefreshAt` for maior que 20min (1 ciclo + margem)

### NFR-04: Acessibilidade (WCAG AA)

- Badges de semaforo: icone + texto (nao somente cor)
- `aria-label` em badges de cor; `aria-live="polite"` em toasts; `aria-live="assertive"` em banner stale
- `aria-busy="true"` no botao "Atualizar agora" durante carregamento
- Contraste: reutilizar `text-secondary` (Story 12.5) e classes de cor com ratio AA confirmado
- Pagina autenticada — fora do gate axe publico (tech debt R2); nasce acessivel por design

### NFR-05: Seguranca

- Nenhum endpoint sem guard (403 para roles incorretos)
- Rate limit Redis antes de qualquer enfileiramento de job
- Sem stack traces expostos ao frontend (pattern `{ statusCode, error, message, details? }`)
- **BOLA prevention:** endpoint GET nao aceita `tenantId` como query param — usa exclusivamente o contexto (licao de 13.1)

---

## Success Criteria

| Criterio | Como verificar |
|---|---|
| MV `mv_tenant_report` criada e populada | Migration roda sem erro; SELECT count retorna dados |
| REFRESH CONCURRENTLY funciona | UNIQUE INDEX presente; REFRESH roda sem erro |
| Isolamento RLS | Teste `mv-tenant-report.rls-spec.ts`: admin tenantA ve 0 linhas de tenantB |
| Performance | Load test: 250k registros, query menor que 2s |
| Rate limit | 2 chamadas POST em menos de 5min: primeira retorna 202, segunda retorna 429 com retryAfter |
| Job BullMQ | Cron registrado, retry apos falha, alerta Pino se maior que 5min |
| UI acessivel | Badges com icone+texto, aria-live nos toasts/banner, aria-busy no botao |
| Schemas Zod | Snapshot tests passam; mudanca de schema quebra o snapshot |

---

## Clarifications

*(A preencher na fase clarify)*

### Decisoes pendentes para clarify/plan

1. **RLS-em-MV (RISCO CRITICO):** Qual opcao de mitigacao adotar? (A: filtro explicito no service, B: security-barrier view, D: ALTER TABLE ENABLE ROW LEVEL SECURITY na MV). O clarify-answerer deve decidir com score >= 2.

2. **`last_refresh_at` — armazenamento:** Usar tabela auxiliar `mv_refresh_log` (referenciada acima) ou coluna adicional em outra tabela de controle? Entidades Prisma existentes tem esse padrao?

3. **Semaforo agregado por grupo na MV:** A MV deve computar o semaforo predominante do grupo como a pior condicao (qualquer vermelho = grupo vermelho) ou como maioria? Verificar padrao em Epic 7.

4. **Stale threshold para banner:** 20min e adequado (1 ciclo de 15min + margem)? Ou configuravel?

5. **Filtro `period` na MV:** A MV e snapshot point-in-time (sem filtro de periodo interno). O filtro `?period=30d` para `avg_attendance_percent` e `avg_trail_progress_percent` — a MV deve ser parametrizada por periodo ou o filtro vai para query ao vivo? Se ao vivo, perde a performance alvo. Decisao arquitetural importante.

---

## Notas de Estrutura

- Backend modulo: `apps/api/src/reports/` (estender existente — NAO criar modulo novo)
- Migration: `apps/api/prisma/migrations/YYYYMMDD_add_mv_tenant_report/migration.sql`
- Processor: `apps/api/src/reports/jobs/refresh-tenant-views.processor.ts`
- Frontend: `apps/web/app/(authenticated)/admin/reports/tenant-summary/page.tsx`
- Tipos: `packages/types/src/reports/tenant-summary.ts`
- Testes RLS: `apps/api/test/rls/mv-tenant-report.rls-spec.ts`
- Padrao de resposta herdado de `getLeaderSummary()` em `reports.service.ts`

---

## Referencias

- Spec autoritativa: `_bmad-output/implementation-artifacts/13-2b-relatorio-por-tenant-com-materialized-views-fr65.md`
- Epic 13: `_bmad-output/planning-artifacts/epics/epic-13.md`
- Story 13.1 entregue: `docs/specs/relatorio-reuniao/spec.md`
- Story 13.2a entregue: `docs/specs/relatorio-lider/spec.md`
- Codigo de referencia: `apps/api/src/reports/` (service + controller + module)
- Regra multi-tenancy absoluta: `docs/project-context.md` (Rule #3 e secao AsyncLocalStorage)
- Constitution: `docs/constitution.md`
