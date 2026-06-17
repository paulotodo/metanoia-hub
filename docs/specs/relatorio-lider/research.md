# Research — Relatório Consolidado por Líder (FR79 / Story 13.2a)

> Phase 0. Resolve unknowns e ancora o plano no código REAL (sondado no
> repositório, não na spec autoritativa). Cada decisão tem
> Decision / Rationale / Alternatives.

## Decision 1 — Localização do método de agregação

**Decision:** `ReportsService.getLeaderSummary()` em
`apps/api/src/reports/reports.service.ts` (módulo da Story 13.1), exposto
por `apps/api/src/reports/reports.controller.ts` (`@Controller('api/v1/reports')`,
guards `KeycloakAuthGuard, RolesGuard, TenantGuard`).

**Rationale:** Sonda do repo confirma que `apps/api/src/reports/` já é o
`ReportsModule` montado em `/api/v1/reports`, com `ReportsController`
expondo `GET trails`, `GET trails/:trailId` (com `@Roles(ADMIN_TENANT, LIDER)`)
e `withTenantTx`+`getRequestContext` em todos os métodos do service.
É o lar natural de uma agregação cross-grupo. Confirma DEC-INF-01 da spec.

**Alternatives considered:**
- `apps/api/src/meetings/reports/` — REJEITADO: escopo de UMA reunião
  (`ReportService.findForUser`, `buildLeaderView`), não cross-grupo.
- `apps/api/src/modules/reports/` (path da spec autoritativa 13-2a) —
  NÃO EXISTE no repo. Falso caminho da spec BMAD.

## Decision 2 — Models e campos reais (sonda contra prisma/schema.prisma)

**Decision:** Usar os campos exatos confirmados; corrigir nomes de tabela
que a spec citou de memória.

| Model | Tabela (@@map) | Campos usados | Correção vs spec |
|-------|----------------|---------------|------------------|
| `Group` | `groups` | id, tenantId, name | spec dizia `group` |
| `GroupMember` | `group_members` | groupId, userId, role, deletedAt | spec dizia `group_member`; **role** default `"membro"` (valores: `lider`/`admin`/`membro`) |
| `GroupTrail` | `group_trails` | groupId, trailId, tenantId | spec dizia `group_trail` |
| `Meeting` | `meeting`(*) | id, tenantId, groupId, scheduledFor, status | — |
| `MeetingAttendance` | `meeting_attendance` | meetingId, userId, tenantId | usar `userId` distinto para presença |
| `ParticipantRadarStatus` | `participant_radar_status` | groupId, **participantId**, status (`RadarStatus`) | chave é `participantId` (não userId); `@@unique([tenantId,groupId,participantId])` |
| `TrailProgress` | `trail_progress` | userId, trailId, tenantId, progressPercent, **completedAt** | `progressPercent Int`, `completedAt DateTime?` |

`enum RadarStatus { verde, amarelo, vermelho }` confirmado.
`atRisk` = status ∈ {`amarelo`,`vermelho`} (FR-02).
`active` = `GroupMember.deletedAt IS NULL` (FR-02 — **supersede** qualquer
leitura de "active deriva de RadarStatus": a fonte canônica de membro ativo
é `GroupMember`).

(*) `Meeting` não tem `@@map` próprio para `groups`-style; usar o nome de
model Prisma `meeting` no client (`tx.meeting`).

**Rationale:** Implementar contra campos inexistentes (`group_member`) gera
erro em runtime. Sonda elimina drift schema↔código.

**Alternatives considered:** Confiar na tabela "Key Entities" da spec —
REJEITADO: 3 nomes de tabela estavam em singular incorreto.

## Decision 3 — Estratégia de agregação (N+1 vs query única)

**Decision:** Agregação **on-demand**, por grupo, com `Promise.all` paralelo
sobre o universo de grupos; dentro de cada grupo, usar `groupBy`/`aggregate`
/`count` do Prisma (não loop por membro). Universo tipicamente < 10 grupos
(DEC-INF-03).

- `activeParticipantsCount`: `groupMember.count({ where:{ groupId, deletedAt:null } })`.
- `atRiskCount`: `participantRadarStatus.count({ where:{ groupId, status:{ in:['amarelo','vermelho'] } } })`.
- `avgTrailProgressPercent`: `trailProgress.aggregate({ _avg:{ progressPercent } })`
  filtrando por userIds dos membros ativos e trailIds de `GroupTrail` do grupo;
  `0` se nenhum.
- `avgAttendancePercent`: por reunião no período, `attendance_rows / active_members`;
  média sobre reuniões; **`null`** se o grupo não teve reuniões no período (dec-008).
- `overallAttendancePercent`: média **ponderada por `activeParticipantsCount`**
  (dec-009), ignorando grupos com `avgAttendancePercent=null`.
- `overallTrailCompletionPercent`: membros com `TrailProgress.completedAt IS NOT NULL`
  / total membros ativos com trilha.
- `totalParticipants`: soma deduplicada por `userId` (DEC-INF-04) — coletar
  `Set<userId>` de membros ativos de todos os grupos.

**Rationale:** Universo pequeno torna `Promise.all`-por-grupo legível e
eficiente; `groupBy/count/aggregate` evita N+1 por participante. Materialized
view fica para a Story 13.2b (fora de escopo aqui — fronteira anotada no plan).

**Alternatives considered:**
- Materialized view agora — REJEITADO: escopo 13.2b.
- Uma única raw query com CTEs cross-grupo — REJEITADO no MVP: menos legível,
  ganho marginal para <10 grupos; pode ser otimização futura sem mudar contrato.

## Decision 4 — RLS / multi-tenant

**Decision:** Toda leitura dentro de `withTenantTx(this.prisma, tx => ...)`,
que executa `SET LOCAL app.current_tenant_id`. `tenantId` derivado de
`getRequestContext()` — **nunca** parâmetro. Universo de grupos:
- `lider`: `GroupMember.role='lider'` do `ctx.userId`.
- `admin_tenant`: todos os grupos do tenant.

**Rationale:** Confirma Princípio I (NON-NEGOTIABLE). `withTenantTx` recusa
tenant não-UUID e exige RequestContext. Teste RLS obrigatório novo em
`apps/api/test/rls/leader-summary.rls-spec.ts` (líder tenant A não vê tenant B).

**Alternatives considered:** Filtro manual `where:{tenantId}` sem `SET LOCAL`
— REJEITADO: RLS é defesa em profundidade exigida pela constituição.

## Decision 5 — Autorização horizontal (líder não vê grupos de outro líder)

**Decision:** O universo de grupos de um `lider` é restrito a grupos onde ele
é `GroupMember.role='lider'`. Nenhum `groupId` de outro líder/grupo entra na
agregação. Se `groupId` é passado e o líder não é dono → grupo simplesmente
não aparece no universo → resposta com `groups:[]` + summary zerado (não 403
genérico de role, mas escopo vazio). `admin_tenant` vê todos os grupos do
tenant. **Sem leak cross-líder.**

**Rationale:** Read-back loop recuperou o finding BOLA da Story 13.1
(`getJobStatus` lia cache sem bind de tenant/requester — mitigado por dec-017).
A lição: **toda leitura precisa bind ao requester, não só ao role.**
Aqui o bind é o universo de grupos derivado de `ctx.userId` + role, não de
input do cliente. `groupId` do cliente é FILTRO sobre o universo já restrito,
nunca SELETOR que amplia acesso.

**Alternatives considered:**
- Confiar só em `@Roles(LIDER, ADMIN_TENANT)` — REJEITADO: role-only é
  exatamente o vetor BOLA da Story 13.1. Authz de objeto (grupo) é obrigatória.
- Retornar 403 quando líder pede `groupId` alheio — REJEITADO: vaza
  existência do grupo; escopo-vazio (groups:[]) é mais seguro e mantém
  contrato uniforme (dec-011).

## Decision 6 — Rota de UI (correção de caminho real)

**Decision:** Página em
`apps/web/app/(authenticated)/app/gestao/relatorios/lider/page.tsx`
(URL `/app/gestao/relatorios/lider`), Client Component com TanStack Query.

**Rationale:** Sonda do `apps/web/app/(authenticated)/app/gestao/` mostra
convenção PT-BR para rotas (`reunioes`, `relatorios`, `radar`) e já existe
`gestao/relatorios/trilhas`. A spec citou `/app/gestao/reports` (inglês);
o caminho REAL alinhado à convenção é `gestao/relatorios/lider`. O endpoint
de API permanece `/api/v1/reports/leader-summary` (inglês, Princípio III:
código/endpoints em inglês; rotas de UI seguem vocabulário PT-BR existente).

**Alternatives considered:** criar `gestao/reports` (inglês) — REJEITADO:
quebra a convenção PT-BR de UI já estabelecida no diretório.

## Decision 7 — Schemas Zod e snapshot

**Decision:** Criar `packages/types/src/reports/leader-summary.ts` (hoje
`reports/` só tem `index.ts`) e re-exportar via `reports/index.ts`. Snapshot
em `packages/types/src/__tests__/leader-summary.snapshot.spec.ts` (mesmo
padrão dos snapshots existentes de reports).

**Rationale:** Princípio IV: contrato compartilhado FE+BE em `packages/types`,
snapshot gate contra breaking change silencioso.

**Alternatives considered:** inline no service — REJEITADO (viola IV).
