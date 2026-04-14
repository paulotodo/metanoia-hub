# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**metanoia-hub** is a B2B SaaS platform for Christian discipleship and pastoral care (EdTech). Currently in pre-implementation phase — architecture and planning artifacts are complete, no production code yet.

Key differentiator: "Pastoral Radar" — a dashboard translating digital participation signals into pastoral visibility (traffic light system).

## Technology Stack

- **Monorepo**: Turborepo 2.5+ with pnpm 10.33.0
- **Frontend**: Next.js 16.2 (App Router, hybrid SSR + CSR)
- **Backend**: NestJS 11.1.17 (REST API, bounded contexts)
- **Database**: PostgreSQL + pgvector, Prisma v7, RLS multi-tenant
- **Auth**: Keycloak (3-layer: roles → guards → RLS)
- **Cache/Jobs**: Redis + BullMQ
- **UI**: Tailwind CSS 4.2.2, shadcn/ui (CLI v4), Zustand 5.0.12, TanStack Query 5.96.2
- **Testing**: Vitest 4.1.2, Playwright 1.59.1, MSW
- **Validation**: Zod 4.3.6 (shared contracts in `packages/types`)

## Monorepo Structure

```
apps/web          — Next.js frontend
apps/api          — NestJS backend
packages/ui       — shadcn components
packages/types    — Zod schemas (shared FE+BE contracts)
packages/config   — ESLint, TSConfig, Tailwind shared config
```

## Development Commands

```bash
# Setup
git clone → ./scripts/setup.sh → docker compose up → pnpm dev

# Docker environments
docker-compose.yml          # local dev
docker-compose.test.yml     # CI testing
docker-compose.prod.yml     # production
```

## Critical Rules

Read `docs/project-context.md` for the full 47-rule set. Key highlights:

### Language
- Code, variables, logs, comments: **English**
- User-facing messages: **PT-BR** (centralized in `apps/web/messages/pt-BR.json`)
- Swagger descriptions: English
- Use **pastoral vocabulary** in UI (not corporate terms)

### TypeScript
- `strict: true` everywhere, no exceptions
- UUID v7 via `uuidv7()` lib — **never** `@default(uuid())` from Prisma
- Dates: ISO 8601 strings. Nulls: explicit `null` (never omit fields). No `undefined` in JSON responses

### Multi-tenancy (Absolute Rule)
- `tenant_id` on **every** table, RLS mandatory from MVP
- Flow: Request → Guard extracts tenant_id from Keycloak token → `AsyncLocalStorage` (`RequestContext`)
- **Never** pass tenant_id as function parameter
- Prisma extension auto-injects tenant_id on all queries

### Frontend Patterns
- Server Components by default (App Router)
- SSR: landing, pricing, blog. CSR: authenticated area
- Server Components use native `fetch` — **no TanStack Query**
- TanStack Query only in Client Components
- Zustand: one store per concern (`useAuthStore`, `useMeetingStore`, `useUIStore`)

### Backend Patterns
- Modules organized by bounded context (auth, tenant, groups, content, meetings, pastoral, analytics, notifications, audit, onboarding)
- Core domains (Pastoral, Meetings, Content): repository pattern
- Supporting subdomains: service direct with Prisma
- Custom `ZodValidationPipe` (~20 lines) — no third-party validation libs
- API versioned: `/api/v1/` prefix from MVP
- Redis namespaces: `cache:*`, `rt:*`, `queue:*`, `rate:*`, `session:*`

### API Contracts
- Success: `{ "data": {...}, "meta?": {...} }` with pagination in meta
- Error: `{ statusCode, error, message, details? }` — no stack traces to frontend
- Create: 201, Delete: 204 (no body), Async: 202
- Domain events: `{ eventId, eventType, version, tenantId, timestamp, data, metadata }`

## Testing

- Unit: `*.spec.ts` (co-located with source)
- Integration: `*.integration-spec.ts`
- E2E: `*.e2e-spec.ts` in `apps/web/e2e/`
- RLS isolation tests in `apps/api/test/rls/` — required for every migration touching policies
- Test factories in `apps/api/test/factories/` — always include `tenantId`
- Snapshot tests required for Zod schemas (gate against silent breaking changes)

## Naming Conventions

| Area | Pattern | Example |
|------|---------|---------|
| TS/TSX files | kebab-case | `user-group.service.ts` |
| Classes/interfaces | PascalCase | `UserGroupService` |
| Functions/variables | camelCase | `findByTenantId` |
| Constants | UPPER_SNAKE_CASE | `MAX_GROUPS_PER_TENANT` |
| REST endpoints | plural, kebab-case | `/api/v1/trail-modules` |
| DB tables | snake_case via `@@map` | `user_groups` |
| DB columns | snake_case via `@map` | `tenant_id` |
| Domain events | context.entity.action | `groups.member.added` |

## Anti-patterns (Forbidden)

- Passing `tenant_id` as function parameter — use AsyncLocalStorage
- `@default(uuid())` in Prisma — use `uuidv7()`
- Creating generic `packages/utils` — use semantic package names
- Mixing server state (TanStack Query) with client state (Zustand)
- TanStack Query in Server Components
- Third-party NestJS validation libs (e.g., `nestjs-zod`)
- Queries leaking data between tenants
- Omitting `tenantId` in domain events or test factories

## Git Workflow

- Branches: kebab-case with intent prefix (`feat/`, `fix/`, `docs/`, `refactor/`)
- Commits: conventional commits in Portuguese
- CI: PR → lint + test + build (Turborepo remote cache). Merge main → build + deploy

### Hard rule — fechamento de tarefa

Ao final de **toda tarefa logicamente completa** (uma WDS Session inteira, uma Story, ou uma unidade de trabalho acordada com o usuário), executar o ciclo completo antes de considerar o trabalho encerrado:

1. **Commit** — conventional commits em português, um ou mais commits atômicos descrevendo o "porquê".
2. **Push** — `git push -u origin <branch>` na branch da tarefa.
3. **PR** — abrir Pull Request para `dev` (ou para a branch base acordada) com corpo descrevendo endpoints ligados, débitos resolvidos e plano de teste.
4. **Merge** — após CI verde e review, mergear o PR.

Exceções explícitas:
- Se a tarefa está **parcialmente completa** (ex.: meio de uma Session), o mínimo obrigatório é commit + push (para não perder trabalho); PR + merge ficam pendentes até o fechamento lógico.
- Se a branch atual depende de outro PR **ainda não mergeado**, alertar o usuário antes de abrir PR contra `dev` — um PR precoce arrastaria commits de dependências.
- Nunca mergear com testes/lint/typecheck vermelhos ou hooks bypassados (`--no-verify`).

## Key Documentation

- `docs/project-context.md` — 47 implementation rules (read before coding)
- `docs/architecture.md` — Full architecture decisions, bounded contexts, requirements
- `docs/prd.md` — Product requirements, modules, success metrics
- `design-artifacts/` — UX/design artifacts (directories A through G)
