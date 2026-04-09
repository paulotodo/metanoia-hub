# Story 1.3: Pipeline CI/CD com GitHub Actions

Status: ready-for-dev

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

- [ ] Task 1: Criar workflow de CI para PRs (AC: #1-#6)
  - [ ] 1.1 Criar `.github/workflows/ci.yml` com trigger em PR para `main` e `dev`
  - [ ] 1.2 Configurar step para `docker compose -f docker-compose.test.yml up -d`
  - [ ] 1.3 Configurar Turborepo remote cache (TURBO_TOKEN, TURBO_TEAM)
  - [ ] 1.4 Adicionar steps: `pnpm turbo lint`, `pnpm turbo test`, `pnpm turbo build`
  - [ ] 1.5 Adicionar step dedicado para RLS isolation tests
  - [ ] 1.6 Configurar jest-axe com smoke test na stub page do Next.js

- [ ] Task 2: Configurar Zod snapshot tests no pipeline (AC: #3)
  - [ ] 2.1 Garantir que snapshot tests de schemas Zod rodam no step `test`
  - [ ] 2.2 Configurar Vitest para incluir `*.spec.ts` com snapshots

- [ ] Task 3: Criar workflow de build para merge em main (AC: #7, #8)
  - [ ] 3.1 Criar `.github/workflows/build.yml` com trigger em push para `main`
  - [ ] 3.2 Configurar Docker build com tag do commit SHA
  - [ ] 3.3 Configurar push para container registry

- [ ] Task 4: Otimizar pipeline para < 10min (AC: #6)
  - [ ] 4.1 Configurar caching de node_modules e Turborepo
  - [ ] 4.2 Configurar caching de Docker layers
  - [ ] 4.3 Paralelizar steps independentes

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
