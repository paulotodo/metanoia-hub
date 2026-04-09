# Story 1.1: Scaffold do Monorepo Turborepo com Next.js, NestJS, Prisma e Docker Compose Mínimo

Status: review

## Story

As a developer,
I want a monorepo scaffold with Turborepo, Next.js (App Router), NestJS, Prisma v7, and shared packages, plus a minimal Docker Compose with PostgreSQL and Redis,
So that I can run `pnpm dev` and have a fully functional local development environment with database, validation contracts and multi-tenant test infrastructure from day one.

## Acceptance Criteria

**Given** the repository is cloned and `pnpm install` is run
**When** I execute `docker compose up` followed by `pnpm dev`
**Then** PostgreSQL is running on port 5432 with a `metanoia_dev` database
**And** Redis is running on port 6379
**And** Next.js starts on port 3000 and renders a stub page at `/`
**And** NestJS starts on port 3001 and exposes `GET /api/health` returning `{ "status": "ok" }`
**And** NestJS connects successfully to PostgreSQL and Redis on boot
**And** the monorepo structure follows: `apps/web`, `apps/api`, `packages/ui`, `packages/types`, `packages/config`
**And** TypeScript `strict: true` is enabled in all packages
**And** ESLint and Prettier are configured with shared config in `packages/config`
**And** Turborepo pipelines are configured for `dev`, `build`, `lint`, `test`, `db:migrate`, `db:rls`, `db:setup`, `db:seed`
**And** a `.env.example` file documents all required environment variables
**And** `@nestjs/config` validates all required env vars on boot with Zod — missing vars cause immediate fail with clear message
**And** Prisma v7 is configured in `apps/api` with a base migration creating a `_health` table
**And** Prisma client extension auto-injects `tenant_id` on all queries (multi-tenant extension pattern)
**And** `uuidv7()` lib is installed and a `generateId()` helper is exported from `packages/types`
**And** `packages/types` is initialized with Zod 4.3.6, an example shared schema (e.g., `PaginationSchema`), and a snapshot test for that schema
**And** `pnpm turbo db:setup` executes migration + RLS policy application successfully
**And** a RLS test helper is created in `apps/api/test/rls/` that provisions 2 test tenants and validates data isolation across CRUD operations
**And** `@@map` and `@map` decorators are used for snake_case DB naming convention

## Tasks / Subtasks

- [x] Task 1: Inicializar monorepo Turborepo com pnpm workspaces (AC: #1-#6)
  - [x] 1.1 Criar `pnpm-workspace.yaml` com apps/* e packages/*
  - [x] 1.2 Configurar `turbo.json` com pipelines: dev, build, lint, test, db:migrate, db:rls, db:setup, db:seed
  - [x] 1.3 Criar estrutura de diretórios: `apps/web`, `apps/api`, `packages/ui`, `packages/types`, `packages/config`

- [x] Task 2: Configurar apps/web — Next.js 16.2 App Router (AC: #3)
  - [x] 2.1 Inicializar Next.js com App Router em `apps/web`
  - [x] 2.2 Criar stub page em `app/page.tsx` renderizando na porta 3000
  - [x] 2.3 Configurar TypeScript `strict: true`

- [x] Task 3: Configurar apps/api — NestJS 11.1 (AC: #4, #5, #10, #11)
  - [x] 3.1 Inicializar NestJS em `apps/api`
  - [x] 3.2 Criar `GET /api/health` retornando `{ "status": "ok" }`
  - [x] 3.3 Configurar `@nestjs/config` com validação Zod de env vars no boot
  - [x] 3.4 Configurar conexão com PostgreSQL e Redis no boot

- [x] Task 4: Configurar packages/config — ESLint, Prettier, TSConfig (AC: #7, #8)
  - [x] 4.1 Criar configuração ESLint compartilhada
  - [x] 4.2 Criar configuração Prettier compartilhada
  - [x] 4.3 Criar tsconfig base com `strict: true`

- [x] Task 5: Configurar packages/types — Zod schemas compartilhados (AC: #14, #15)
  - [x] 5.1 Inicializar package com Zod 4.3.6
  - [x] 5.2 Criar `PaginationSchema` como exemplo
  - [x] 5.3 Criar snapshot test do schema
  - [x] 5.4 Instalar `uuidv7` e exportar helper `generateId()`

- [x] Task 6: Configurar Prisma v7 multi-tenant (AC: #12, #13, #17)
  - [x] 6.1 Configurar Prisma v7 em `apps/api`
  - [x] 6.2 Criar migration base com tabela `_health` usando `@@map` e `@map` para snake_case
  - [x] 6.3 Implementar Prisma client extension que auto-injeta `tenant_id` em todas queries

- [x] Task 7: Docker Compose mínimo — PostgreSQL + Redis (AC: #1, #2)
  - [x] 7.1 Criar `docker-compose.yml` com PostgreSQL 16 na porta 5432 (db: `metanoia_dev`)
  - [x] 7.2 Adicionar Redis 7 na porta 6379
  - [x] 7.3 Criar `.env.example` documentando todas variáveis

- [x] Task 8: RLS test infrastructure (AC: #16, #17)
  - [x] 8.1 Criar script `db:rls` para aplicar policies RLS
  - [x] 8.2 Criar RLS test helper em `apps/api/test/rls/` com 2 test tenants
  - [x] 8.3 Validar isolamento de dados em CRUD operations
  - [x] 8.4 Configurar `pnpm turbo db:setup` para executar migration + RLS

## Dev Notes

### Stack & Versões
- Turborepo 2.5+, pnpm 10.33.0
- Next.js 16.2 (App Router)
- NestJS 11.1.17
- Prisma v7
- PostgreSQL 16, Redis 7
- Zod 4.3.6
- Vitest 4.1.2 para testes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Nenhuma — esta é a primeira story do projeto (fundação)

### Project Structure Notes
```
/
├── apps/
│   ├── web/                    # Next.js 16.2
│   │   ├── app/page.tsx        # Stub page
│   │   └── tsconfig.json
│   └── api/                    # NestJS 11.1
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── health/
│       │   └── prisma/
│       │       └── prisma.extension.ts  # Multi-tenant extension
│       ├── prisma/
│       │   └── schema.prisma
│       └── test/rls/           # RLS test helpers
├── packages/
│   ├── ui/                     # shadcn components (init later)
│   ├── types/                  # Zod schemas
│   │   ├── src/
│   │   │   ├── pagination.ts
│   │   │   └── id.ts           # generateId() helper
│   │   └── __tests__/
│   │       └── pagination.spec.ts  # snapshot test
│   └── config/                 # ESLint, TSConfig, Prettier
├── docker-compose.yml
├── .env.example
├── turbo.json
└── pnpm-workspace.yaml
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-01.md — Story 1.1]
- [Source: docs/project-context.md — Regras de multi-tenancy, naming conventions, TypeScript strict]
- [Source: _bmad-output/planning-artifacts/architecture.md — Monorepo structure, tech stack]

## Dev Agent Record

### Completion Notes

- **Monorepo scaffolded** com Turborepo 2.9.5, pnpm 10.33.0 workspaces, pipelines completos (dev/build/lint/test/db:migrate/db:rls/db:setup/db:seed)
- **packages/config** com ESLint 9 flat config, Prettier, TSConfig base/next/nest — tudo strict:true
- **packages/types** com Zod 4.3.6, PaginationSchema + snapshot test, generateId() via uuidv7 — 7 testes passando
- **packages/ui** stub preparado para shadcn
- **apps/web** Next.js 16.2.3 App Router com stub page em localhost:3000
- **apps/api** NestJS 11.1.18 com GET /api/health, validação Zod de env vars, PrismaModule global, RedisModule global — 8 testes passando
- **Prisma v7** configurado com `prisma.config.ts` (padrão v7), adapter `@prisma/adapter-pg`, migration base com tabela `_health`
- **Multi-tenant extension** com AsyncLocalStorage + SET LOCAL app.current_tenant_id
- **Docker Compose** com PostgreSQL 16 + Redis 7, healthchecks, role `metanoia_app` (NOSUPERUSER) para enforcement de RLS
- **RLS policies** aplicadas via script `apply-rls.sh`, 3 testes de isolamento validando select/update/delete cross-tenant
- **Decisão técnica — Prisma v7:** Requer `prisma.config.ts` com `datasource.url` (não aceita `url` no schema.prisma). PrismaClient requer adapter `@prisma/adapter-pg`
- **Decisão técnica — RLS:** Superusers do PostgreSQL bypassa RLS mesmo com FORCE. Criado role `metanoia_app` (NOSUPERUSER) com DATABASE_APP_URL separado para conexões da aplicação
- **Decisão técnica — RLS policies:** Uso de `nullif(current_setting('app.current_tenant_id', true), '')::uuid` para tratar corretamente string vazia vs NULL
- **Total: 15 testes passando** (7 packages/types + 4 env validation + 1 health controller + 3 RLS isolation)

## File List

### New Files

- `.env.example`
- `.gitignore`
- `docker-compose.yml`
- `docker/postgres/init-app-role.sql`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `turbo.json`
- `packages/config/package.json`
- `packages/config/eslint.config.mjs`
- `packages/config/prettier.config.mjs`
- `packages/config/tsconfig.base.json`
- `packages/config/tsconfig.nest.json`
- `packages/config/tsconfig.next.json`
- `packages/types/package.json`
- `packages/types/tsconfig.json`
- `packages/types/vitest.config.ts`
- `packages/types/src/index.ts`
- `packages/types/src/pagination.ts`
- `packages/types/src/id.ts`
- `packages/types/src/__tests__/pagination.spec.ts`
- `packages/types/src/__tests__/__snapshots__/pagination.spec.ts.snap`
- `packages/types/src/__tests__/id.spec.ts`
- `packages/ui/package.json`
- `packages/ui/src/index.ts`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/nest-cli.json`
- `apps/api/vitest.config.ts`
- `apps/api/prisma.config.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260409035409_init_health_table/migration.sql`
- `apps/api/prisma/migrations/migration_lock.toml`
- `apps/api/prisma/rls/001-health-rls.sql`
- `apps/api/scripts/apply-rls.sh`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/config/env.validation.ts`
- `apps/api/src/config/__tests__/env.validation.spec.ts`
- `apps/api/src/prisma/prisma.extension.ts`
- `apps/api/src/prisma/prisma.service.ts`
- `apps/api/src/prisma/prisma.module.ts`
- `apps/api/src/redis/redis.service.ts`
- `apps/api/src/redis/redis.module.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/health/health.module.ts`
- `apps/api/src/health/__tests__/health.controller.spec.ts`
- `apps/api/test/rls/rls-test.helper.ts`
- `apps/api/test/rls/health-rls.integration-spec.ts`

### Modified Files

- `_bmad-output/implementation-artifacts/1-1-scaffold-do-monorepo-turborepo-com-nextjs-nestjs-prisma.md` (status + checkboxes + Dev Agent Record)

## Change Log

| Data | Alteração |
|------|-----------|
| 2026-04-09 | Implementação completa da Story 1.1 — scaffold do monorepo com Turborepo, Next.js 16.2, NestJS 11.1, Prisma v7, Docker Compose (PostgreSQL 16 + Redis 7), shared packages (config, types, ui), multi-tenant extension com AsyncLocalStorage, RLS policies e testes de isolamento. 15 testes passando. |
