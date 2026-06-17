# Feature Spec: Relatório Consolidado por Líder (FR79)

short_name: relatorio-lider
version: 1.0.0
epic: Epic 13 — Relatórios Avançados & Analytics
story: 13.2a
status: draft
author: agente-00c-feature-orchestrator
date: 2026-06-17

---

## Sumário

Como Líder de Grupo, quero um relatório agregado de todos os meus grupos para ter visão holística do meu impacto pastoral.

A feature entrega:
- **Backend**: endpoint `GET /api/v1/reports/leader-summary?period=7d|30d|90d|custom` no `ReportsService` existente (apps/api/src/reports/), com método `getLeaderSummary()`. Analytics é supporting subdomain — service direto com Prisma, sem repository pattern.
- **Tipos compartilhados**: schemas Zod em `packages/types/src/reports/` (arquivo `leader-summary.ts`), com snapshot tests.
- **Frontend**: página Client Component `/app/gestao/reports` com filtros (período, grupo, semáforo), cards por grupo com drill-down, TanStack Query.
- **Testes**: integração (1/3/5 grupos), RLS isolation (lider tenant A não vê tenant B), E2E filtros.

### Dependências confirmadas
- Epic 5: `Meeting` + `MeetingAttendance` (presença por reunião)
- Epic 7: `ParticipantRadarStatus` + `RadarStatus` enum (`verde|amarelo|vermelho`) — contagem em risco
- Epic 8: `Trail` + `TrailProgress` (progressPercent, completedAt) — progresso de trilha
- Story 13.1 (relatorio-reuniao, PR #162, merged): `ReportsModule`, `ReportsService`, `ReportsController` em `apps/api/src/reports/` — **reusar e estender**
- `GroupMember` (role `lider`), `Group`, `GroupTrail`

### Nota de estrutura real (resolve ambiguidade da spec autoritativa)
A spec 13-2a menciona `apps/api/src/modules/reports/` — este caminho **não existe**. O caminho real é `apps/api/src/reports/` (deliverable da Story 13.1). O novo método `getLeaderSummary()` é adicionado diretamente neste módulo.

---

## Clarifications

### Session 2026-06-17

**Q1 (dec-008, score 3): Grupo sem reuniões no período → avgAttendancePercent**
Quando um grupo não teve reuniões no período selecionado, retornar `avgAttendancePercent: null` (campo explicitamente nulo).
Justificativa: FR-06 especifica "campos ausentes retornam `null` explícito" (nunca `undefined`). `null` distingue "sem dado no período" de "0% de presença em reuniões realizadas".

**Q2 (dec-009, score 2): Peso de overallAttendancePercent**
Ponderar `overallAttendancePercent` pelo `activeParticipantsCount` de cada grupo (grupos maiores têm mais peso na média geral).
Justificativa: Representa proporcionalmente o impacto pastoral de cada grupo. Alinhado com DEC-INF-04 (deduplicação por `userId` no `totalParticipants`).

**Q3 (dec-010, score 3): Filtro de semáforo client-side — granularidade**
O filtro de semáforo client-side opera sobre **cards de grupo inteiros**: selecionar "vermelho/amarelo" mostra apenas grupos com `atRiskCount > 0`; selecionar "verde" mostra grupos com `atRiskCount = 0`. O payload permanece como especificado em FR-06 (sem campos `greenCount`/`yellowCount`/`redCount`).
Justificativa: DEC-INF-03 confirma que o payload de todos os grupos é pequeno (< 10 entradas tipicamente); não há necessidade de breakdown adicional. Preserva contrato FR-06 sem alterações.

**Q4 (dec-011, score 2): Formato de resposta quando groupId fornecido**
Quando `groupId` é fornecido como query param, o formato de resposta permanece idêntico ao FR-06: `data.groups[]` (array com 1 item) + `summary` calculado apenas para esse grupo.
Justificativa: Consistência de contrato — mesmo schema para todos os casos. Facilita consumo pelo frontend (mesmo parser) e preserva compatibilidade futura.

**Q5 (dec-012, score 2): Logging estruturado para SLA**
`getLeaderSummary()` deve registrar log estruturado ao final da execução com: `{ duration_ms, groupCount, totalParticipants }` para rastreabilidade do SLA de SC-03 (< 1s).
Justificativa: Boa prática NestJS; não cria dependência nova; suporta diagnóstico proativo de degradação de performance em produção.

---

## User Stories

### US-01: Relatório agregado por grupos (líder)

**Como** Líder de Grupo autenticado,
**Quando** acesso `GET /api/v1/reports/leader-summary?period=30d`,
**Então** recebo um relatório com:
- Por grupo: presença média (%), progresso médio de trilha (%), contagem de participantes em risco (semáforo vermelho/amarelo), contagem de participantes ativos
- Sumário geral: total de grupos, total de participantes, % presença geral, % conclusão de trilha geral

### US-02: Filtro de período customizado

**Como** Líder de Grupo,
**Quando** passo `period=custom&startDate=ISO&endDate=ISO`,
**Então** os dados de presença são calculados dentro do intervalo explícito

### US-03: Visão holística em painel web

**Como** Líder de Grupo,
**Quando** acesso `/app/gestao/reports`,
**Então** vejo filtros de período (7d, 30d, 90d, custom), grupo específico e status de semáforo, com cards por grupo exibindo métricas e link de drill-down para o grupo

### US-04: Admin Tenant com visão cross-grupo

**Como** Admin Tenant,
**Quando** acesso `GET /api/v1/reports/leader-summary`,
**Então** recebo o mesmo relatório agregado sobre todos os grupos do tenant (não filtrado por liderança)

---

## Requisitos Funcionais

### FR-01: Endpoint GET /api/v1/reports/leader-summary

O sistema deve expor `GET /api/v1/reports/leader-summary` no `ReportsController` existente (`apps/api/src/reports/reports.controller.ts`).

**Query params:**
- `period`: `enum('7d','30d','90d','custom')` — obrigatório
- `startDate`: `string (ISO 8601)` — obrigatório quando `period=custom`
- `endDate`: `string (ISO 8601)` — obrigatório quando `period=custom`
- `groupId`: `string (UUID)` — opcional; filtra para um único grupo (drill-down)

**Auth guard:** `@Roles(Role.LIDER, Role.ADMIN_TENANT)` via `KeycloakAuthGuard + RolesGuard + TenantGuard`.

**Universo de grupos:**
- `lider`: grupos onde o usuário é `GroupMember.role = 'lider'`
- `admin_tenant`: todos os grupos do tenant

### FR-02: Agregação por grupo

Para cada grupo no universo do líder, retornar:

| Campo | Fonte | Cálculo |
|-------|-------|---------|
| `groupId` | Group.id | — |
| `groupName` | Group.name | — |
| `avgAttendancePercent` | MeetingAttendance / Meeting | reuniões do grupo no período; presença = linhas em MeetingAttendance / total de membros ativos por reunião; média sobre as reuniões |
| `avgTrailProgressPercent` | TrailProgress.progressPercent | média de progressPercent dos membros ativos do grupo com TrailProgress vinculado a trilha do grupo (GroupTrail); 0 se nenhum |
| `atRiskCount` | ParticipantRadarStatus.status | contagem de membros com status `vermelho` ou `amarelo` no grupo |
| `activeParticipantsCount` | GroupMember | contagem de membros ativos (deletedAt IS NULL) |

**Performance:** agregação on-demand com queries eficientes (índices em `tenant_id+group_id`). Materialização é escopo da Story 13.2b — fora do escopo desta feature. Para grandes volumes (>10 grupos ou >500 membros), considerar `Promise.all` paralelo por grupo.

### FR-03: Sumário geral

O payload de resposta inclui objeto `summary` com:

| Campo | Cálculo |
|-------|---------|
| `totalGroups` | contagem de grupos no universo |
| `totalParticipants` | soma de `activeParticipantsCount` de todos os grupos (deduplica por userId se um membro estiver em múltiplos grupos) |
| `overallAttendancePercent` | média ponderada de `avgAttendancePercent` pelos grupos |
| `overallTrailCompletionPercent` | % de membros com `TrailProgress.completedAt IS NOT NULL` / total membros ativos com trilha |

### FR-04: Filtro de período

| `period` | Cálculo de `startDate` / `endDate` |
|----------|-------------------------------------|
| `7d` | now - 7 dias |
| `30d` | now - 30 dias |
| `90d` | now - 90 dias |
| `custom` | usar `startDate` + `endDate` da query (validação Zod: ISO 8601, startDate < endDate) |

O filtro de período aplica-se ao cálculo de presença (reuniões `scheduledFor` dentro do range). Progresso de trilha e contagem em risco são calculados com estado **atual** (sem filtro de data), pois refletem situação corrente do participante.

### FR-05: Isolamento multi-tenant

- `tenant_id` em toda tabela; RLS ativo em Postgres
- `AsyncLocalStorage` / `getRequestContext()` para derivar `tenantId` — **nunca** passado como parâmetro de função
- Um líder nunca acessa grupos ou dados de outro tenant
- Teste RLS obrigatório em `apps/api/test/rls/`

### FR-06: Contrato de resposta da API

**Sucesso 200:**
```json
{
  "data": {
    "groups": [
      {
        "groupId": "uuid-v7",
        "groupName": "Grupo Alpha",
        "avgAttendancePercent": 72.5,
        "avgTrailProgressPercent": 45.0,
        "atRiskCount": 2,
        "activeParticipantsCount": 12
      }
    ],
    "summary": {
      "totalGroups": 3,
      "totalParticipants": 31,
      "overallAttendancePercent": 68.3,
      "overallTrailCompletionPercent": 22.6
    }
  },
  "meta": {
    "period": "30d",
    "startDate": "2026-05-18T00:00:00Z",
    "endDate": "2026-06-17T23:59:59Z"
  }
}
```

**Erro 400** (params inválidos): `{ "statusCode": 400, "error": "Bad Request", "message": "...", "details": [...] }`
**Erro 403** (sem grupos / sem role): `{ "statusCode": 403, "error": "Forbidden", "message": "Acesso negado: sem grupos gerenciados" }`

Datas em ISO 8601 (`string`). Campos numéricos: `number` (float %). Sem valores `undefined` — campos ausentes retornam `null` explícito ou valor padrão `0`.

### FR-07: Schemas Zod em packages/types

Criar `packages/types/src/reports/leader-summary.ts` com:
- `LeaderSummaryPeriodSchema`: `z.enum(['7d','30d','90d','custom'])`
- `LeaderSummaryQuerySchema`: period + startDate? + endDate? + groupId? (com refinement: custom exige ambas datas; startDate < endDate)
- `LeaderGroupMetricsSchema`: campos do FR-02
- `LeaderSummaryMetaSchema`: period + startDate + endDate
- `LeaderSummaryResponseSchema`: `{ data: { groups: LeaderGroupMetrics[], summary: {...} }, meta: LeaderSummaryMeta }`
- Snapshot tests em `packages/types/src/__tests__/leader-summary.snapshot.spec.ts`
- Export via `packages/types/src/reports/index.ts`

### FR-08: Interface de relatório acessível (gate a11y permanente)

- Badges de semáforo (verde/amarelo/vermelho): contraste WCAG AA; representação por **ícone + texto** (nunca só cor)
- Cards de grupo: `aria-label` descritivo (`"Grupo Alpha: 12 participantes, 72% presença"`)
- Tabela de participantes em risco (se exibida): header `<th scope="col">`, caption
- Filtros de período: usar `FormField` (Epic 12, Story 12.5) com `label` associado
- Token `text-secondary` (nunca `text-muted` — tech debt R2 do Epic 12)
- Página `/app/gestao/reports` é área autenticada (fora do gate axe automatizado — tech debt R2), mas deve nascer acessível per design

### FR-09: Frontend — página /app/gestao/reports

- **Componente**: Client Component (`'use client'`)
- **Dados**: TanStack Query (`useQuery`) com chave `['leader-summary', period, groupId, startDate, endDate]`
- **Filtros**: período (7d/30d/90d/custom), grupo específico (dropdown), status semáforo (multi-select: verde/amarelo/vermelho)
  - Filtros de grupo e semáforo são **client-side** sobre os dados já carregados (não requerem nova chamada à API)
  - Filtro de período dispara nova chamada à API (altera query params)
- **Layout**: cards por grupo (Grid responsive), cada card com métricas + link `href="/app/gestao/groups/{groupId}"`
- **Estados**: loading skeleton, empty state pastoral ("Nenhum grupo encontrado neste período"), error state
- **i18n**: todas as strings PT-BR em `apps/web/messages/pt-BR.json` (chaves sob `reports.leader.*`)

---

## Key Entities & Caminhos Reais

| Entidade | Tabela Prisma | Campos relevantes |
|----------|--------------|------------------|
| Group | `group` | id, tenantId, name, dayOfWeek |
| GroupMember | `group_member` | groupId, userId, role (`lider|membro`), deletedAt |
| GroupTrail | `group_trail` | groupId, trailId, tenantId |
| Meeting | `meeting` | id, tenantId, groupId, scheduledFor, status |
| MeetingAttendance | `meeting_attendance` | meetingId, userId, tenantId, joinTime, leaveTime, totalDurationSeconds |
| ParticipantRadarStatus | `participant_radar_status` | groupId, participantId, status (RadarStatus enum: `verde|amarelo|vermelho`), presencePercentage, lastActiveAt |
| TrailProgress | `trail_progress` | userId, trailId, tenantId, progressPercent, completedAt, updatedAt |

### Caminhos de arquivo (confirmados contra repo real)

| Artefato | Caminho |
|----------|---------|
| Backend service (extend) | `apps/api/src/reports/reports.service.ts` |
| Backend controller (extend) | `apps/api/src/reports/reports.controller.ts` |
| Backend module (extend) | `apps/api/src/reports/reports.module.ts` |
| Zod types | `packages/types/src/reports/leader-summary.ts` |
| Types index | `packages/types/src/reports/index.ts` |
| Types snapshot test | `packages/types/src/__tests__/leader-summary.snapshot.spec.ts` |
| Frontend page | `apps/web/app/(authenticated)/gestao/reports/page.tsx` |
| Frontend filter component | `apps/web/app/(authenticated)/gestao/reports/components/leader-summary-filters.tsx` |
| Frontend group card | `apps/web/app/(authenticated)/gestao/reports/components/group-summary-card.tsx` |
| RLS test | `apps/api/test/rls/leader-summary-rls.spec.ts` |
| Integration test | `apps/api/src/reports/__tests__/leader-summary.service.spec.ts` |
| i18n | `apps/web/messages/pt-BR.json` (chaves `reports.leader.*`) |

---

## User Scenarios & Testing

### P1: Líder com 3 grupos acessa relatório de 30d

**Setup:** líder do tenant A com 3 grupos, cada grupo com 2–5 reuniões no período, membros com presença variada e `ParticipantRadarStatus` mixed.
**Ação:** `GET /api/v1/reports/leader-summary?period=30d`
**Expect:**
- 200 com `data.groups` contendo 3 entradas
- `data.summary.totalGroups = 3`
- `avgAttendancePercent` de cada grupo condizente com reuniões do período
- `atRiskCount` = soma de membros com status vermelho ou amarelo

### P2: Filtro por período customizado

**Ação:** `GET /api/v1/reports/leader-summary?period=custom&startDate=2026-05-01T00:00:00Z&endDate=2026-05-31T23:59:59Z`
**Expect:** `meta.startDate` e `meta.endDate` refletem o range; apenas reuniões do mês de maio incluídas no cálculo de presença

### P3: Lider sem grupos

**Setup:** usuário com role `lider` mas sem nenhum `GroupMember.role = 'lider'`
**Expect:** 403 `{ "statusCode": 403, "error": "Forbidden", "message": "Acesso negado: sem grupos gerenciados" }`

### P4: Isolamento RLS — líder tenant A não vê tenant B

**Setup:** líder no tenant A; tenant B possui 5 grupos com dados ricos
**Ação:** `GET /api/v1/reports/leader-summary?period=30d` com token do tenant A
**Expect:** `data.groups` não contém grupos do tenant B

### P5: UI — cards de grupo e filtros

**Ação:** acessar `/app/gestao/reports` como líder
**Expect:**
- Cards renderizados com métricas de cada grupo
- Filtro de período dispara nova chamada; filtros de grupo/semáforo filtram client-side
- Badges de semáforo possuem ícone + texto (não só cor)
- Cada card tem `aria-label` descritivo

---

## Success Criteria

### SC-01: Cobertura de relatório
O endpoint retorna dados para todos os grupos liderados pelo usuário autenticado, sem omitir grupos do tenant corrente. _(P1)_

### SC-02: Precisão de presença
`avgAttendancePercent` corresponde à razão reuniões com presença / total de reuniões no período, com precisão de 1 casa decimal. _(P1, P2)_

### SC-03: Tempo de resposta
Para líder com até 10 grupos e 100 participantes por grupo, o endpoint responde em < 1 segundo (on-demand, sem materialized view). _(Consideração de performance, FR-02)_

### SC-04: Isolamento multi-tenant garantido
Nenhuma linha de dados de outro tenant aparece no relatório, validado por teste RLS automatizado. _(P4, FR-05)_

### SC-05: Contrato de resposta
A resposta segue exatamente o schema `LeaderSummaryResponseSchema` (Zod), confirmado por snapshot test. _(FR-06, FR-07)_

### SC-06: Acessibilidade WCAG AA
Badges de semáforo passam em checagem de contraste AA e possuem representação não-dependente de cor; cards possuem `aria-label`. _(P5, FR-08)_

### SC-07: Filtro de período correto
Para `period=custom`, apenas reuniões dentro do range startDate–endDate são computadas. _(P2)_

### SC-08: Admin Tenant com visão cross-grupo
Admin Tenant recebe todos os grupos do tenant, não apenas grupos onde é líder. _(US-04, FR-01)_

---

## Fora do Escopo

- **Materialized views / refresh periódico**: Story 13.2b (separada)
- **Export CSV** do relatório de líder: não solicitado nesta story
- **Tendência histórica** de presença por grupo: nice-to-have, fora do MVP desta story
- **Notificações push** baseadas em risco detectado: escopo Epic 13.3 (Story 13.3)
- **Páginas autenticadas no gate axe automatizado**: tech debt R2 (Epic 12)
- **Repository pattern** para analytics: violação de arquitetura (supporting subdomain)

---

## Dependências

| Dependência | Status | Observação |
|-------------|--------|-----------|
| Story 13.1 (relatorio-reuniao) | Done (PR #162) | ReportsModule/Service/Controller disponíveis para extensão |
| Epic 5 (Meeting/MeetingAttendance) | Done | Schema confirmado no prisma |
| Epic 7 (ParticipantRadarStatus) | Done | Enum RadarStatus: `verde|amarelo|vermelho` confirmado |
| Epic 8 (TrailProgress) | Done | progressPercent, completedAt confirmados |
| Epic 12 (a11y) | Done | FormField (Story 12.5), token text-secondary disponíveis |

---

## Decisões de Infraestrutura

### DEC-INF-01: Localização do novo método
**Decisão:** `ReportsService.getLeaderSummary()` adicionado em `apps/api/src/reports/reports.service.ts` (módulo 13.1), **não** em `apps/api/src/meetings/reports/`.
**Justificativa:** Relatório de líder é agregação cross-grupo, não pertence ao módulo de reuniões. O módulo `apps/api/src/reports/` já exporta `ReportsService` e está no escopo do `ReportsController`. Path `apps/api/src/modules/reports/` referenciado na spec autoritativa não existe no repositório real.

### DEC-INF-02: Agregação on-demand
**Decisão:** Calcular on-demand por query Prisma eficiente; não usar materialized view.
**Justificativa:** Story 13.2b é o milestone de materialização. Esta story entrega valor imediato. Para volumes esperados de MVP (líderes com < 10 grupos), a latência on-demand é aceitável (< 1s conforme SC-03).

### DEC-INF-03: Filtros client-side vs. server-side
**Decisão:** Filtros de grupo específico e status de semáforo são **client-side**. Filtro de período é **server-side** (altera query params da API).
**Justificativa:** O payload de todos os grupos de um líder é pequeno (< 10 entradas tipicamente). Filtros client-side evitam round-trips desnecessários e permitem UX responsiva.

### DEC-INF-04: Cálculo de `totalParticipants` com deduplicação
**Decisão:** Deduplica membros por `userId` antes de somar ao total geral.
**Justificativa:** Um participante pode estar em múltiplos grupos do mesmo líder. Somar sem deduplicar distorceria `totalParticipants` e `overallAttendancePercent`.
