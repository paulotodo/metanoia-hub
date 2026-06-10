# Reconciliação Epic 8 (Trilhas / Content) — Pré-flight W1b.1

**Data:** 2026-06-10
**Base:** `dev` @ `f88d90b` (limpa, = origin/dev)
**Escopo auditado:** `apps/api/src/`, `apps/web/`, `packages/types/src/`, `apps/api/prisma/schema.prisma`
**Stories:** 8-1, 8-2, 8-3 (W1b.1, sequencial)

## Veredito por story

| Story | Classificação | Residual |
|-------|---------------|----------|
| 8-1 CRUD Trilhas/Módulos/Aulas | **NOVA** | Tudo: schema + módulo `content` + Zod + RLS |
| 8-2 Tipos de conteúdo + upload | **NOVA (com gap)** | Tudo + **construir o storage service do zero** (MinIO existe só como env/health, NÃO há módulo) |
| 8-3 Progresso individual | **NOVA** | Tudo: models progress + worker BullMQ + domain event; infra BullMQ existe p/ espelhar |

## Evidência da auditoria

### Banco / schema (`apps/api/prisma/schema.prisma`)
Models existentes: Health, MeetingEvent, Meeting, MeetingParticipantRecord, MeetingAttendance, MeetingTelemetry, MeetingReport, MeetingSnapshot, Reflection, User, UserTenant, Consent, Tenant, Invite, Group, GroupMember, PastoralAlert, PastoralAction, PastoralNote, OutreachIntent, ParticipantRadarStatus, ParticipantStatusImproved, DemoRequest, ContactMessage; enums RadarStatus, RadarTrend.
- **AUSENTES:** `Trail`, `Module`, `Lesson`, `LessonProgress`, `ModuleProgress`, `TrailProgress`, `ContentMetadata`; enums `TrailStatus`, `LessonContentType`, `LessonStatus`. → 8-1/8-2/8-3 criam todos.
- Datasource Prisma v7 + adapter `PrismaPg` (`@prisma/adapter-pg`), conexão RLS via `DATABASE_APP_URL`.

### API (`apps/api/src/` — estrutura FLAT)
Módulos: admin-invites, admin-pastoral, admin-users, auth, bullmq, common, config, consent, group-members, groups, health, invites, marketing, meetings, observability, onboarding, participant-groups, pastoral, prisma, redis, super-admin, tenants, users.
- **`content/` NÃO existe** → 8-1 cria `apps/api/src/content/` (flat, NÃO `src/modules/content/`).
- **`storage`/`upload` NÃO existem** (`find` vazio). MinIO presente só em `config/env.validation.ts` (`MINIO_*`) e `health.controller.ts` (probe `/minio/health/live`). → **8-2 constrói o storage service** (artifact diz "Epic 1 storage module" — não existe; gap a cobrir).
- BullMQ: `bullmq/bullmq.service.ts` expõe factory `new Queue(name, {...})`. Radar usa `pastoral/radar/radar-calculation.worker.ts` + `radar-job.service.ts` → padrão a espelhar para `queue:lesson-progress` (8-3).

### packages/types (`src/` + registrar em `index.ts`)
- Sem nenhum tipo de content. → 8-1 cria `packages/types/src/content/*.ts` e registra em `index.ts`.
- **Snapshot tests:** padrão REAL é `packages/types/src/__tests__/<dominio>.snapshot.spec.ts` (um arquivo por domínio, sufixo `.snapshot.spec.ts`), regenerado com `vitest run -u`. → criar `content.snapshot.spec.ts` (NÃO o `packages/types/__tests__/schemas.snapshot.test.ts` do artifact, que está errado).

### Frontend (`apps/web`)
- Páginas/rotas: `apps/web/app/(authenticated)/app/...` (App Router; só `consumo/grupos/` hoje).
- Componentes/hooks/lib: **`apps/web/src/components/`, `apps/web/src/hooks/`, `apps/web/src/lib/api/hooks/`** → artifact 8-2 (`apps/web/src/components/content/`) está CORRETO p/ componentes.
- MSW handlers em `apps/web/mocks/handlers/`, fixtures em `apps/web/__mocks__/`.

### RLS (`apps/api/test/rls/`)
- Sufixo REAL `.rls-spec.ts` (hífen), helper `rls-test.helper.ts`, adapter `PrismaPg` + `DATABASE_APP_URL`. → criar `trails.rls-spec.ts`, `modules.rls-spec.ts`, `lessons.rls-spec.ts` (8-1) e `lesson-progress.rls-spec.ts` (8-3).

### sprint-status.yaml (`_bmad-output/implementation-artifacts/`)
`epic-8: in-progress`; `8-1/8-2/8-3: ready-for-dev`. → marcar story→done a cada merge; epic-8 permanece in-progress (só vira done ao fechar 8-1..8-10).

## Correções de caminho (Project Structure Notes dos artifacts ERRADAS → usar REAL)
- `apps/api/src/modules/content/` → **`apps/api/src/content/`** (flat).
- `packages/types/__tests__/schemas.snapshot.test.ts` → **`packages/types/src/__tests__/content.snapshot.spec.ts`** (`.snapshot.spec.ts`).
- RLS `*.rls.spec.ts` → **`*.rls-spec.ts`** (hífen) + usar `rls-test.helper.ts`.
- Zod em `packages/types/src/content/` + **registrar exports em `packages/types/src/index.ts`**.
- FE componentes `apps/web/src/components/content/` (ok); FE páginas `apps/web/app/(authenticated)/app/...`.
- 8-2: **construir** storage service MinIO (sem módulo Epic 1 pré-existente).

## Dependências desbloqueadas após W1b.1
Story 4-4 (associar trilha↔grupo) e AC#4 deferido da 6-4 (trail progress no radar via domain event `content.trail.progress_updated`).
