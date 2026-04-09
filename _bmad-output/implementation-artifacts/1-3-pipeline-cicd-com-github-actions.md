# Story 1.3: Pipeline CI/CD com GitHub Actions

Status: review

## Story

As a developer,
I want CI/CD pipelines configured with GitHub Actions,
So that every PR is validated automatically and merges to main build Docker images.

## Acceptance Criteria

**Given** a PR is opened against `main` or `dev`
**When** the CI pipeline runs
**Then** it starts services using `docker-compose.test.yml` for ephemeral test databases
**And** it executes `lint`, `test`, and `build` using Turborepo remote cache
**And** Zod schema snapshot tests are included in the test pipeline
**And** RLS isolation tests are executed as a dedicated pipeline step
**And** jest-axe is configured with a smoke test on the Next.js stub page (pipeline ready for real components)
**And** the pipeline completes in under 10 minutes for a clean cache

**Given** a PR is merged to `main`
**When** the build pipeline runs
**Then** Docker images are built and tagged with the commit SHA
**And** images are pushed to the container registry

## Tasks / Subtasks

- [x] Task 1: Criar workflow de CI para PRs (AC: #1-#6)
  - [x] 1.1 Criar `.github/workflows/ci.yml` com trigger em PR para `main` e `dev`
  - [x] 1.2 Configurar step para `docker compose -f docker-compose.test.yml up -d`
  - [x] 1.3 Configurar Turborepo remote cache (TURBO_TOKEN, TURBO_TEAM)
  - [x] 1.4 Adicionar steps: `pnpm turbo lint`, `pnpm turbo test`, `pnpm turbo build`
  - [x] 1.5 Adicionar step dedicado para RLS isolation tests
  - [x] 1.6 Configurar jest-axe com smoke test na stub page do Next.js

- [x] Task 2: Configurar Zod snapshot tests no pipeline (AC: #3)
  - [x] 2.1 Garantir que snapshot tests de schemas Zod rodam no step `test`
  - [x] 2.2 Configurar Vitest para incluir `*.spec.ts` com snapshots

- [x] Task 3: Criar workflow de build para merge em main (AC: #7, #8)
  - [x] 3.1 Criar `.github/workflows/build.yml` com trigger em push para `main`
  - [x] 3.2 Configurar Docker build com tag do commit SHA
  - [x] 3.3 Configurar push para container registry

- [x] Task 4: Otimizar pipeline para < 10min (AC: #6)
  - [x] 4.1 Configurar caching de node_modules e Turborepo
  - [x] 4.2 Configurar caching de Docker layers
  - [x] 4.3 Paralelizar steps independentes

## Dev Notes

### Stack & Versões
- GitHub Actions
- Turborepo 2.5+ remote cache
- Vitest 4.1.2
- jest-axe para accessibility tests
- Docker Compose v2

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.1 (Scaffold do Monorepo) — estrutura de diretórios e Turborepo pipelines
- Story 1.2 (Docker Compose Completo) — `docker-compose.test.yml`

### Project Structure Notes
```
/
├── .github/
│   └── workflows/
│       ├── ci.yml              # PR validation pipeline
│       └── build.yml           # Build + push images on merge to main
├── docker-compose.test.yml     # CI environment (from Story 1.2)
└── turbo.json                  # Pipeline definitions
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-01.md — Story 1.3]
- [Source: docs/project-context.md — Git Workflow, CI pipeline]
- [Source: _bmad-output/planning-artifacts/architecture.md — CI/CD strategy]

## Dev Agent Record

### Implementation Plan
- CI workflow com 4 jobs parallelizados: setup → lint + test (paralelo) → build
- Build workflow com Docker Buildx e push para GitHub Container Registry (ghcr.io)
- Dockerfiles multi-stage para API (NestJS) e Web (Next.js standalone)
- Cache strategy: pnpm store + Turborepo remote cache + Docker layer cache (GHA)
- jest-axe instalado no web app com smoke test na stub page

### Debug Log
- `@testing-library/dom@^10.6.0` não existia no npm — corrigido para `^10.4.1`
- `jsdom@^26.1.0` não existia — corrigido para `^29.0.2`
- ESLint falha em todos os packages por falta de config files — issue pré-existente do Story 1.1
- API build falha por TypeScript deprecation warnings no tsconfig — issue pré-existente do Story 1.1

### Completion Notes
- ✅ CI workflow criado com lint, test, build parallelizados e RLS tests dedicados
- ✅ Zod snapshot tests já incluídos no pipeline via `pnpm turbo test` (confirmado)
- ✅ jest-axe configurado com smoke test na stub page (1 test passing)
- ✅ Build workflow criado com Docker Buildx, tag SHA, push para ghcr.io
- ✅ Dockerfiles multi-stage criados para API e Web
- ✅ Next.js standalone output habilitado para Docker
- ✅ Caching otimizado: pnpm store, Turborepo remote cache, Docker layer GHA cache
- ✅ Jobs parallelizados: lint e test rodam em paralelo, build depende de ambos
- ⚠️ Lint e build com falhas pré-existentes de Story 1.1 (ESLint config, TS deprecations)

## File List

- `.github/workflows/ci.yml` — CI pipeline para PRs (novo)
- `.github/workflows/build.yml` — Build + push pipeline para merge em main (novo)
- `apps/api/Dockerfile` — Dockerfile multi-stage para NestJS (novo)
- `apps/web/Dockerfile` — Dockerfile multi-stage para Next.js standalone (novo)
- `apps/web/app/__tests__/accessibility.spec.tsx` — Smoke test jest-axe (novo)
- `apps/web/vitest.config.ts` — Configuração Vitest para web (novo)
- `apps/web/package.json` — Adicionadas deps de teste (modificado)
- `apps/web/next.config.ts` — Habilitado output standalone (modificado)
- `pnpm-lock.yaml` — Lockfile atualizado (modificado)

## Change Log

- 2026-04-09: Implementação completa da Story 1.3 — Pipeline CI/CD com GitHub Actions
