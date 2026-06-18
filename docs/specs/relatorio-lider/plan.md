# Plano de Implementação — Relatório Consolidado por Líder (FR79 / Story 13.2a)

## Summary

Expor `GET /api/v1/reports/leader-summary` no `ReportsController` existente
(`apps/api/src/reports/`), agregando, por grupo do universo do líder/admin,
presença média, progresso de trilha, contagem em risco e participantes ativos,
mais um sumário geral. Leitura **on-demand** (sem materialized view — Story
13.2b), via `withTenantTx`+`getRequestContext` (RLS, tenant nunca como
parâmetro), com autorização horizontal (líder só vê seus grupos). Contrato Zod
em `packages/types/src/reports/leader-summary.ts` (snapshot) e UI Client
Component em `/app/gestao/relatorios/lider` (TanStack Query, WCAG AA).

Abordagem técnica vem da sonda do repo real (research.md): estende a Story 13.1
sem nova migration; corrige 3 nomes de tabela e a rota de UI face à spec.

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript `strict:true` — NestJS 11 (api), Next.js 16.2 (web) |
| Persistência | PostgreSQL + Prisma v7, RLS multi-tenant — **sem migration** nesta feature |
| Auth | Keycloak (roles) → NestJS Guards → RLS; `AsyncLocalStorage`/`RequestContext` |
| Contratos | Zod em `packages/types` (`reports/leader-summary.ts`) + snapshot |
| Testing | Vitest (unit/integration), Playwright (e2e), RLS specs em `apps/api/test/rls/` |
| Frontend | Client Component + TanStack Query (polling não necessário; query simples) |
| Roles | `@Roles(Role.LIDER, Role.ADMIN_TENANT)` |
| NEEDS CLARIFICATION restantes | 0 |

## Constitution Check

*GATE: passou antes do Phase 0; re-checado após Phase 1 (sem novas violações).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS | `withTenantTx` (SET LOCAL tenant), tenant via RequestContext, RLS spec obrigatório, authz 3 camadas (Keycloak→Guards→RLS) + authz horizontal de grupo |
| II. Type-Safety & IDs determinísticos | PASS | `strict:true`; datas ISO 8601; `null` explícito (`avgAttendancePercent`); sem migration (sem novos IDs) |
| III. Idioma & Vocabulário Pastoral | PASS | endpoint/código/logs em inglês; mensagens PT-BR em `pt-BR.json`; rota UI PT-BR (`relatorios/lider`); UI vocabulário pastoral |
| IV. Contratos de API Padronizados | PASS | Zod em `packages/types`; `{data,meta}`/`{statusCode,error,message,details}`; `/api/v1/`; `ZodValidationPipe`; snapshot |
| V. Separação de Estado FE | PASS | TanStack Query SÓ em Client Component; sem mistura com Zustand |
| VI. Qualidade Verificável | PASS | unit+integration+e2e; RLS spec; snapshot; WCAG AA (axe-core gate Epic 12); CI verde antes de done |
| VII. Processo de Entrega Auditável | PASS | 1 story = 1 branch = 1 PR; conventional commits PT-BR |

Nenhuma violação MUST. Complexity Tracking: N/A.

## Project Structure

### Documentação (feature dir)
```
docs/specs/relatorio-lider/
├── spec.md            (Clarified — 12 decisões)
├── plan.md            (este arquivo)
├── research.md        (Phase 0 — 7 decisões; corrige nomes de tabela + rota)
├── data-model.md      (Phase 1 — entidades reusadas + DTOs Zod)
├── quickstart.md      (Phase 1 — 12 cenários incl. roundtrip E2E + RLS)
└── contracts/
    └── leader-summary.md   (GET /api/v1/reports/leader-summary)
```

### Código-fonte (árvore REAL — pontos de toque)
```
apps/api/src/reports/
├── reports.controller.ts     (+ @Get('leader-summary'), @Roles(LIDER,ADMIN_TENANT))
├── reports.service.ts        (+ getLeaderSummary(): withTenantTx + getRequestContext)
└── __tests__ / *.spec.ts     (+ unit do getLeaderSummary)
apps/api/test/rls/
└── leader-summary.rls-spec.ts            (NOVO — isolamento tenant A↔B)
packages/types/src/reports/
├── leader-summary.ts                     (NOVO — schemas Zod)
└── index.ts                              (+ re-export)
packages/types/src/__tests__/
└── leader-summary.snapshot.spec.ts       (NOVO — snapshot)
apps/web/app/(authenticated)/app/gestao/relatorios/lider/
├── page.tsx                              (NOVO — Client Component)
└── _components/                          (NOVO — filtros + cards de grupo)
apps/web/src/lib/api/hooks/
└── use-leader-summary.ts                 (NOVO — TanStack Query, padrão use-trail-reports)
apps/web/messages/pt-BR.json              (+ strings user-facing PT-BR)
```

Caminhos verificados contra o repo. Correções vs spec: tabelas reais são
`groups`/`group_members`/`group_trails` (plural); rota de UI real é
`gestao/relatorios/lider` (PT-BR), não `gestao/reports`.

## Convenções de Borda

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | `@map`/`@@map` no Prisma | `apps/api/prisma/schema.prisma` |
| Prisma client model fields | camelCase | tipos gerados | `@prisma/client` (auto-map) |
| Backend DTO (response) | camelCase | Zod (`.parse` antes de retornar) | `packages/types/src/reports/leader-summary.ts` |
| Frontend DTO | camelCase | Zod `.parse` no fetch | re-import de `@metanoia/types` |
| API payload (req/resp) | camelCase | Zod ambos os lados | `contracts/leader-summary.md` |
| URL query params | camelCase (`startDate`,`endDate`,`groupId`) | `ZodValidationPipe` | contrato + schema |
| URL de rota UI | kebab/PT-BR (`relatorios/lider`) | Next router | árvore de `app/` |

**Mapper DB↔DTO**: ORM auto-mapping = SIM (Prisma `@map`/`@@map`). Sem mapper
manual; o service projeta campos Prisma (camelCase) direto nos DTOs camelCase.
**Validação Zod**: ambas as bordas — BE valida a response com
`LeaderSummaryResponseSchema` antes de devolver; FE re-parse no hook.

## Decisões de Plano (resumo — detalhe em research.md)
- D1: método em `apps/api/src/reports/reports.service.ts` (DEC-INF-01).
- D2: campos/tabelas reais sondados (corrige `group_member`→`group_members` etc).
- D3: agregação on-demand `Promise.all`-por-grupo + `groupBy/count/aggregate`
  (evita N+1); sem MV (13.2b).
- D4: RLS via `withTenantTx`; tenant via RequestContext.
- D5: authz horizontal — universo derivado de `ctx.userId`+role; `groupId` é
  filtro, nunca seletor que amplia acesso (lição BOLA da Story 13.1).
- D6: rota UI `gestao/relatorios/lider` (PT-BR real).
- D7: Zod em `packages/types/src/reports/leader-summary.ts` + snapshot.

## Riscos & Mitigações
| Risco | Mitigação |
|-------|-----------|
| **BOLA / acesso horizontal cross-líder (A01/API1)** | Universo de grupos derivado de `ctx.userId`+role; `groupId` filtra dentro do universo, nunca amplia; `groupId` alheio → `groups:[]`. Teste P6 obrigatório. Lição direta do finding da Story 13.1 (read-back loop, dec-017). |
| Vazamento cross-tenant (A01) | `withTenantTx` SET LOCAL + RLS; RLS spec P8 obrigatório (A↔B). |
| Drift snake↔camelCase BE↔FE | Roundtrip E2E P10 com `.parse` do payload REAL (não mock). |
| N+1 em muitos grupos/membros | `groupBy/count/aggregate` por grupo + `Promise.all`; universo <10 (DEC-INF-03). MV escalável fica para 13.2b. |
| `avgAttendancePercent` 0 vs null confundido | `null` explícito quando sem reuniões (dec-008); ponderação ignora null. |
| `participantId` vs `userId` (RadarStatus) | Documentado em data-model: RadarStatus usa `participantId`; dedup de totalParticipants usa `GroupMember.userId`. |

## Gate de Segurança (owasp-security) — resultado

Escopo: OWASP Top 10:2025 + API Security Top 10:2023, foco authz/tenant/BOLA.
Nenhum finding `critical`/`high` BLOQUEANTE: o desenho INCORPORA as mitigações
como acceptance criteria. Findings residuais viram critérios de teste obrigatórios.

| ID | Sev | Categoria | Finding | Mitigação (incorporada como AC) |
|----|-----|-----------|---------|---------------------------------|
| S1 | medium→mitigado | A01/API1 BOLA | `groupId` poderia ser usado como SELETOR que amplia acesso (vetor da Story 13.1 em getJobStatus). | `groupId` é FILTRO sobre o universo derivado de `ctx.userId`+role (espelha `resolveParticipantUserIds`: `where{tenantId,userId,role:'lider'}` em reports.service.ts:559). `groupId` alheio → `groups:[]`. **AC + teste P6 obrigatório.** |
| S2 | medium→mitigado | A01 cross-tenant | Query agregada cross-grupo poderia varrer outros tenants. | Toda leitura em `withTenantTx` (SET LOCAL app.current_tenant_id) + RLS; tenant via RequestContext nunca param; `withTenantTx` recusa tenant não-UUID. **RLS spec P8 obrigatório (A↔B).** |
| S3 | low→mitigado | API1 / enumeração | 403 ao pedir `groupId` alheio vazaria existência do grupo. | Escolhido escopo-vazio (`groups:[]`, 200) em vez de 403 (dec-011 + Decision 5). Não vaza existência. |
| S4 | low→aceito | A07/role | role-only authz repetiria o vetor BOLA da 13.1. | RolesGuard (deny-by-default) + TenantGuard (fail-closed) + authz horizontal de objeto (universo de grupos). Defesa em 3+ camadas — não role-only. |
| S5 | info | A09 logging | Log estruturado não deve vazar PII. | Logging só `{duration_ms, groupCount, totalParticipants}` (dec-012) — contagens, sem nome/email/UUID de tenant. Conforme. |
| S6 | info | API4 consumo | Agregação on-demand sem cap poderia ser cara. | Universo <10 grupos (DEC-INF-03); `Promise.all`+`groupBy/count/aggregate` evita N+1. MV escalável = 13.2b. Sem endpoint de export (sem amplificação). |

**Veredito:** PASS condicionado. As mitigações S1/S2/S3 são MUST e já estão no
contrato/quickstart como critérios de aceitação + testes obrigatórios (P6, P8).
Nenhuma escalada a decisão de produto necessária — segue o pipeline.


## Re-check de Constitution (pós Phase 1)
Design não introduziu serviço/camada nova nem complexidade não justificada —
estende módulo existente. Todos os MUST permanecem PASS.

## Próximos passos (pipeline)
1. `/checklist` — quality gate de requisitos.
2. `/create-tasks` — decompor em backlog executável.
3. `/analyze` — consistência cross-artifact (após tasks).
