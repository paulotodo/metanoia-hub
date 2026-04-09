# Story 4.5: Participante Visualiza Seus Grupos

Status: ready-for-dev

## Story

As a Participante,
I want to see a list of groups I belong to,
So that I can navigate to my discipleship groups easily.

## Acceptance Criteria

**Given** I am authenticated as Participante
**When** I access `GET /api/v1/groups/me`
**Then** I see a paginated list of my groups with: group name, leaders (names), member count, trails associated, and my own status in the group (`active`/`invited`)
**And** pagination follows the standard meta format (total, page, limit)
**And** I can sort by group name or join date

**Given** I do not belong to any group
**When** I access `GET /api/v1/groups/me`
**Then** the API returns 200 with an empty `data` array and meta with `total: 0` (not 404)

**Given** I belong to groups in my tenant
**When** I access the endpoint
**Then** RLS guarantees I only see groups where I am a member — no cross-tenant or cross-group leakage

## Tasks / Subtasks

- [ ] Task 1: API — listar meus grupos (AC: #1, #2, #3)
  - [ ] 1.1 Criar `GET /api/v1/groups/me`
  - [ ] 1.2 Query: groups onde user é membro via group_members
  - [ ] 1.3 Incluir: group name, leaders (names), member count, trails associadas, status do user no grupo
  - [ ] 1.4 Paginação: `{ data: [...], meta: { total, page, limit } }`
  - [ ] 1.5 Sorting: por group name ou join date

- [ ] Task 2: Tratamento de lista vazia (AC: #4, #5)
  - [ ] 2.1 Retornar 200 com `{ data: [], meta: { total: 0, page: 1, limit: 20 } }`
  - [ ] 2.2 Nunca retornar 404 para lista vazia

- [ ] Task 3: RLS e isolamento (AC: #6, #7)
  - [ ] 3.1 Garantir que RLS filtra por tenant_id
  - [ ] 3.2 Garantir que user só vê grupos onde é membro
  - [ ] 3.3 Teste: cross-tenant leakage impossível
  - [ ] 3.4 Teste: cross-group leakage impossível

- [ ] Task 4: Zod schemas e snapshot tests
  - [ ] 4.1 Criar `MyGroupsResponseSchema` em `packages/types`
  - [ ] 4.2 Snapshot test

- [ ] Task 5: Frontend — Meus Grupos
  - [ ] 5.1 Criar `apps/web/app/(authenticated)/groups/me/page.tsx`
  - [ ] 5.2 Lista de grupos com nome, líderes, contagem de membros, trilhas
  - [ ] 5.3 Estado vazio: mensagem amigável "Você ainda não faz parte de nenhum grupo"
  - [ ] 5.4 Sorting toggles
  - [ ] 5.5 Testes jest-axe

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
