## Epic 1: Fundação Habilitadora do Produto

Épico habilitador (não entrega valor direto ao usuário). Desenvolvedor pode clonar, rodar `pnpm dev` e ter monorepo Turborepo + Next.js + NestJS + PostgreSQL + Keycloak + Redis + LiveKit via Docker Compose, com CI/CD, observabilidade, design tokens e layout base configurados.

### Story 1.1: Scaffold do Monorepo Turborepo com Next.js, NestJS, Prisma e Docker Compose Mínimo

As a developer,
I want a monorepo scaffold with Turborepo, Next.js (App Router), NestJS, Prisma v7, and shared packages, plus a minimal Docker Compose with PostgreSQL and Redis,
So that I can run `pnpm dev` and have a fully functional local development environment with database, validation contracts and multi-tenant test infrastructure from day one.

**Acceptance Criteria:**

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

### Story 1.2: Docker Compose Completo com Keycloak, MinIO e LiveKit

As a developer,
I want the Docker Compose extended with Keycloak, MinIO and LiveKit services,
So that all infrastructure dependencies are available locally for auth, storage and video features.

**Acceptance Criteria:**

**Given** Docker is installed and the base Docker Compose from Story 1.1 is running
**When** I run `docker compose up` with the complete configuration
**Then** Keycloak is running on port 8080 with a `metanoia` realm loaded from `infra/keycloak/realm-export.json` on startup
**And** MinIO is running on port 9000 with a `metanoia-storage` bucket created
**And** LiveKit is running on port 7880 with test API keys configured in `.env`
**And** NestJS boot completes without errors and connects to all services (PostgreSQL, Redis, Keycloak, MinIO)
**And** `.env.example` is updated with all new environment variables documented
**And** a `docker-compose.test.yml` is created for CI environment with ephemeral databases and minimal resource allocation
**And** a new developer cloning the repo can run `docker compose up && pnpm dev` without any manual Keycloak configuration

### Story 1.3: Pipeline CI/CD com GitHub Actions

As a developer,
I want CI/CD pipelines configured with GitHub Actions,
So that every PR is validated automatically and merges to main build Docker images.

**Acceptance Criteria:**

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

### Story 1.4: Spike Técnico — Keycloak Multi-tenant com 4 Roles e Google OAuth

As a developer,
I want a validated Keycloak configuration with multi-tenant support, 4 initial roles, and Google OAuth,
So that I have confidence the auth architecture works before building identity features.

**Acceptance Criteria:**

**Given** Keycloak is running via Docker Compose with the `metanoia` realm loaded from JSON
**When** the realm configuration is validated
**Then** 4 realm roles are defined: `super_admin`, `admin_tenant`, `lider`, `participante`
**And** Google OAuth is configured as an identity provider in the realm
**And** a test user can register with email/password and receive a valid JWT
**And** a test user can login via Google OAuth and receive a valid JWT
**And** the JWT token includes `realm_roles`, `tenant_id`, and `user_id` claims via custom mappers
**And** a NestJS `KeycloakAuthGuard` can extract and validate the JWT token
**And** the guard rejects expired, malformed, or missing tokens with appropriate error responses
**And** the final realm configuration is exported as JSON and committed to `infra/keycloak/realm-export.json`
**And** Docker Compose loads this JSON automatically on boot (no manual configuration required for new devs)
**And** **time-box:** this spike must be completed in 3 days maximum
**And** if spike fails within time-box, a decision document is created in `docs/decisions/` evaluating auth alternatives (e.g., JWT self-issued, Auth.js)

### Story 1.5: Observabilidade Base — Pino Structured Logging, Sentry e RequestContext

As a developer,
I want structured logging with Pino, error tracking with Sentry, and a RequestContext middleware using AsyncLocalStorage,
So that every request is traceable with tenant_id and user_id, and application errors generate automatic alerts with sufficient context.

**Acceptance Criteria:**

**Given** NestJS is running with the Pino logger configured
**When** an HTTP request is received
**Then** the `RequestContext` middleware extracts `tenant_id` and `user_id` from the Keycloak JWT and stores them in AsyncLocalStorage
**And** Pino automatically includes `tenant_id`, `user_id`, `request_id`, and `correlation_id` in every log line for that request
**And** logs are output as structured JSON (not plain text)
**And** unauthenticated requests (e.g., health check) log without tenant_id/user_id but still include request_id
**And** Sentry is configured for error tracking with `@sentry/nestjs`
**And** unhandled exceptions and rejected promises are captured by Sentry with tenant_id and user_id context
**And** a test utility in `apps/api/test/utils/log-capture.ts` captures Pino logs during tests and allows assertions on structured fields (tenant_id, action, etc.)
**And** NFR-O1 is met: logs are available for troubleshooting within 5 minutes (structured JSON queryable by tenant_id)
**And** NFR-O2 is met: application errors generate Sentry alerts with sufficient diagnostic context

### Story 1.6: Spike Técnico — Pipeline Real-time (LiveKit → Redis → BullMQ → SSE)

As a developer,
I want a validated proof-of-concept of the real-time pipeline using authenticated requests and structured logging,
So that I have confidence the architecture works before building meeting features.

**Acceptance Criteria:**

**Given** Keycloak spike (Story 1.4) is validated and a valid JWT token is available
**And** RequestContext middleware (Story 1.5) is injecting tenant_id/user_id into AsyncLocalStorage
**When** a simulated LiveKit webhook event `room.participant_joined` is sent to the NestJS endpoint
**Then** the RequestContext middleware extracts `tenant_id` and `user_id` from the JWT
**And** the event is stored in Redis under namespace `rt:meeting:{tenantId}:{meetingId}:presence`
**And** a BullMQ job is enqueued in `queue:meetings`
**And** the BullMQ worker processes the job and flushes the event from Redis to PostgreSQL
**And** an SSE endpoint `GET /api/v1/sse/meetings/:id` pushes the event to connected clients (authenticated via JWT)
**And** a minimal React component receives and displays the SSE event in real-time
**And** all pipeline steps produce structured Pino logs with tenant_id and meeting_id
**And** the full pipeline completes in under 2 seconds end-to-end
**And** events from Tenant A are NOT visible to SSE subscribers of Tenant B (namespace isolation validated with 2 concurrent tenants)
**And** **time-box:** this spike must be completed in 3 days maximum

### Story 1.7: Design Tokens, Tipografia, Espaçamento e shadcn/ui Base

As a developer,
I want design tokens (colors, typography, spacing) configured as CSS custom properties with Tailwind integration, and shadcn/ui initialized with base components,
So that all future UI work follows a consistent visual foundation with reusable accessible components.

**Acceptance Criteria:**

**Given** the `packages/config/tailwind.preset.ts` is loaded by Next.js
**When** I use semantic classes like `bg-surface-base`, `text-brand-teal`, `text-care-urgent`
**Then** the correct CSS custom properties are applied
**And** CSS custom properties are defined in `:root` for:
  - Brand: `brand-teal` (#2B7A78), `brand-teal-light` (#3AAFA9), `brand-teal-dark` (#17252A), `brand-terracotta` (#C1666B), `brand-terracotta-light` (#D4918A)
  - Pastoral: `care-urgent` (#C1666B), `care-attention` (#D4A24C), `care-ok` (#7BA38A), `care-neutral` (#8E8D8A)
  - Surfaces: `surface-base` (#FAFAF8), `surface-elevated` (#FFFFFF), `surface-sunken` (#F2F0ED)
  - Interactive states: `hover`, `active`, `focus`, `disabled` tokens
**And** Inter font is loaded via `next/font` with latin + latin-ext subsets
**And** typography scale is configured: Display 36px/700, H1 30px/700, H2 24px/600, Body 16px/400, Body Small 14px/400, Caption 12px/500, Overline 11px/600
**And** spacing follows base-4px scale with density tokens per experience (Consumo 20-24px, Gestão 16-20px, Admin 12-16px)
**And** structure is prepared for dark mode (CSS custom properties redefinable via `.dark` class)
**And** shadcn/ui (CLI v4) is initialized in `packages/ui/components/` with base components: Button, Card, Input, Dialog
**And** base components use the design tokens (not default shadcn colors)
**And** all base components pass jest-axe accessibility tests

### Story 1.8: Layout Base — NavigationConfig, Sidebar e Bottom Tabs

As a developer,
I want the base application layout with unified navigation that renders as bottom tabs on mobile and sidebar on desktop,
So that all future pages share a consistent navigation structure across devices.

**Acceptance Criteria:**

**Given** the design tokens and shadcn/ui components from Story 1.7 are available
**When** I navigate to the authenticated app area
**Then** a `NavigationConfig` object defines 5 tabs: Radar, Reuniões, Trilhas, Perfil, Mais
**And** on mobile (< lg breakpoint), navigation renders as bottom tabs with icons and labels
**And** on screens ≤360px, bottom tabs show icon-only with labels only on the active tab
**And** on desktop (≥ lg breakpoint), navigation renders as a fixed sidebar (240px width) with icons and full labels
**And** the active tab/item is visually highlighted with `brand-teal`
**And** responsive breakpoints work correctly: base, sm, md, lg, xl, 2xl
**And** container uses `mx-auto` and `max-w-7xl` (1280px) for main content
**And** touch targets are ≥ 44px on mobile
**And** keyboard navigation works: Tab/Shift+Tab between nav items, Enter to activate
**And** `motion-safe:transition-all` is used for any navigation transitions (with reduced-motion alternative)
**And** navigation component passes jest-axe accessibility tests

---

