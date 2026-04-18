# Story 4.5: Participante Visualiza Seus Grupos

Status: ready-for-dev

> **Correction note (2026-04-18, WDS Cenário 06 Session 0):** endpoint and frontend route were renamed to align with page spec **06.4 — Lista dos Meus Grupos** and architecture UX-DR22–25 (which reserves `/app/consumo/*` as the participant experience). Previous spec used `GET /api/v1/groups/me` + `/groups/me/page.tsx`. The canonical version is now `GET /api/v1/participant/groups` + `/app/consumo/grupos`. Detail endpoint and route added as `GET /api/v1/participant/groups/:id` + `/app/consumo/grupos/[id]`. The `firstVisit` meta flag and the `participant.group.first_view` domain event are introduced to match the page spec.

## Story

As a Participante,
I want to see a list of groups I belong to,
So that I can navigate to my discipleship groups easily.

## Acceptance Criteria

**Given** I am authenticated as Participante
**When** I access `GET /api/v1/participant/groups`
**Then** I see a list of my groups — each item carries the group name, the leader's first name (no surnames, no email), and the next scheduled meeting (if any)
**And** the response envelope is `{ data: [...], meta: { firstVisit: boolean } }` — no pagination meta in MVP (the participant typically belongs to 1–3 groups)
**And** `firstVisit = true` on the very first call per participant, then persists as `false`

**Given** I do not belong to any group
**When** I access `GET /api/v1/participant/groups`
**Then** the API returns 200 with `data: []` and `meta.firstVisit` (not 404)

**Given** I belong to groups in my tenant
**When** I access the endpoint
**Then** RLS guarantees I only see groups where I am a member — no cross-tenant or cross-group leakage

**Given** `firstVisit === true` on a successful response
**Then** the domain event `participant.group.first_view` is emitted (analytics only — never surfaced to the participant as metric)

**Given** I am authenticated as Participante and I open a specific group
**When** I access `GET /api/v1/participant/groups/:id`
**Then** I see the group detail — name, description (nullable), leader (first name + optional avatar), recurrence, next meeting, and the list of other participants showing **first name only** (no avatars, no contact info, no status markers)

## Tasks / Subtasks

- [ ] Task 1: API — listar meus grupos (AC: #1, #2, #3)
  - [ ] 1.1 Criar `GET /api/v1/participant/groups`
  - [ ] 1.2 Query: groups onde user é membro via `group_members`
  - [ ] 1.3 Incluir: group name, leader first name, next meeting summary
  - [ ] 1.4 Envelope: `{ data: [...], meta: { firstVisit } }`

- [ ] Task 2: Tratamento de lista vazia (AC: #4)
  - [ ] 2.1 Retornar 200 com `{ data: [], meta: { firstVisit } }`
  - [ ] 2.2 Nunca retornar 404 para lista vazia

- [ ] Task 3: RLS e isolamento (AC: #5, #6)
  - [ ] 3.1 Garantir que RLS filtra por tenant_id
  - [ ] 3.2 Garantir que user só vê grupos onde é membro
  - [ ] 3.3 Teste: cross-tenant leakage impossível
  - [ ] 3.4 Teste: cross-group leakage impossível

- [ ] Task 4: Zod schemas e snapshot tests
  - [ ] 4.1 Criar `ParticipantGroupsListResponseSchema` + `ParticipantGroupDetailResponseSchema` em `packages/types` _(delivered in WDS Cenário 06 Session 0)_
  - [ ] 4.2 Snapshot tests _(delivered in WDS Cenário 06 Session 0)_

- [ ] Task 5: Frontend — Meus Grupos
  - [ ] 5.1 Criar `apps/web/app/(authenticated)/app/consumo/grupos/page.tsx`
  - [ ] 5.2 Criar `apps/web/app/(authenticated)/app/consumo/grupos/[id]/page.tsx`
  - [ ] 5.3 Lista de grupos com nome, líder (primeiro nome), próxima reunião
  - [ ] 5.4 Estado vazio pastoral: "Ainda não tem grupo por aqui. Assim que um líder te confirmar num grupo, ele aparece aqui."
  - [ ] 5.5 Detalhe: "Outros participantes" mostra apenas primeiro nome — sem avatar, sem contato
  - [ ] 5.6 Testes jest-axe

- [ ] Task 6: Domain event `participant.group.first_view`
  - [ ] 6.1 Emit no primeiro GET bem-sucedido por participante
  - [ ] 6.2 Nunca expor métricas ao participante — evento é analytics, não UI

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Prisma v7 + RLS
- Zod 4.3.6
- Next.js 16.2 (App Router)
- TanStack Query 5.96.2

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 4.1 (CRUD Grupos) — tabela groups existe
- Story 4.2 (Membros) — tabela group_members existe
- Story 4.4 (Trilhas) — tabela group_trails existe (para mostrar trilhas associadas)
- Story 2.4 (Guards) — KeycloakAuthGuard (autenticação)

### Project Structure Notes
```
apps/api/src/groups/
├── groups.controller.ts        # GET /groups/me (adicionar a este controller)
└── groups.service.ts           # findMyGroups method

packages/types/src/groups/
├── my-groups-response.ts
└── __tests__/
    └── my-groups.spec.ts       # Snapshot test

apps/api/test/rls/
└── groups-me.rls.spec.ts       # RLS tests for /groups/me

apps/web/app/(authenticated)/groups/
└── me/
    ├── page.tsx
    └── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-04.md — Story 4.5]
- [Source: docs/project-context.md — Pagination format, empty list handling]
- [Source: _bmad-output/planning-artifacts/architecture.md — Groups module, participant view]
