# Story 8.3: Progresso Individual & Percentual de Conclusão

Status: ready-for-dev

## Story

As a Participante,
I want my progress to be tracked automatically as I consume trail content,
so that I can see how far I've advanced and resume where I left off.

## Acceptance Criteria

**Given** I am a participant assigned to a group that has a trail associated
**When** I open a lesson for the first time
**Then** a `LessonProgress` record is created with: `id` (UUID v7), `userId`, `lessonId`, `tenantId`, `status` (enum: `not_started`, `in_progress`, `completed`), `progressPercent` (0-100), `startedAt`, `completedAt` (nullable), `lastAccessedAt`
**And** the record is persisted via `content.repository.ts` (repository pattern)

**Given** I am consuming a lesson
**When** a progress event occurs (video time update, scroll position, manual mark)
**Then** a BullMQ job is enqueued in `queue:lesson-progress` with payload: `{ userId, lessonId, tenantId, progressPercent, eventType }`
**And** the BullMQ worker processes the job asynchronously and updates `LessonProgress` in PostgreSQL
**And** progress is NOT updated synchronously in the request path (async via queue for resilience)
**And** failed jobs retry 3x with exponential backoff (1s, 2s, 4s). After 3 failures, job moves to `queue:lesson-progress:failed` for manual inspection (NFR-I4: jobs falhados retidos para reprocessamento)

**Given** a lesson is marked as `completed`
**When** the progress is persisted
**Then** `ModuleProgress` is recalculated: `completedLessons / totalLessons * 100`
**And** `TrailProgress` is recalculated: `completedModules / totalModules * 100` (a module is complete when all its lessons are complete)
**And** a domain event `content.trail.progress_updated` is emitted with: `{ eventId, eventType: "content.trail.progress_updated", version: 1, tenantId, timestamp, data: { userId, trailId, progressPercent, previousPercent }, metadata: { correlationId } }`
**And** this domain event will be consumed by the Pastoral module (Epic 6) to update the semáforo with trail progress signals — pastoral subscription to be added as Story 6.9 or documented as planned tech debt in Epic 6
**And** the domain event schema is validated via Zod snapshot test (contract test) in `packages/types/__tests__/schemas.snapshot.test.ts` to prevent silent breaking changes between content and pastoral modules
**And** an integration test validates the full pipeline: lesson consumed → BullMQ job enqueued → progress persisted → module/trail recalculated → domain event emitted with correct payload

**Given** I navigate to "Meu Progresso" or the trail listing
**When** the page loads
**Then** each trail shows a progress bar with the overall completion percentage
**And** each module within a trail shows its completion percentage
**And** lessons show status icons: not started (circle), in progress (half-circle), completed (checkmark)
**And** "Continuar de onde parei" link takes me to the last accessed incomplete lesson

**Given** LessonProgress records exist
**When** a query is made across tenants
**Then** RLS ensures I can only see my own progress within my tenant
**And** RLS isolation tests validate cross-tenant and cross-user isolation

## Tasks / Subtasks

- [ ] Task 1: Criar Prisma schemas para progress tracking (AC: #1)
  - [ ] Model LessonProgress: id, userId, lessonId, tenantId, status (enum), progressPercent (Int), startedAt, completedAt (nullable), lastAccessedAt
  - [ ] Enum LessonStatus: not_started, in_progress, completed
  - [ ] Considerar ModuleProgress e TrailProgress como views/computed ou tabelas auxiliares
  - [ ] UUID v7, @@map com snake_case
  - [ ] Migration com RLS policies
- [ ] Task 2: Implementar enqueue de progress events (AC: #2)
  - [ ] Endpoint `POST /api/v1/progress/lessons/:lessonId` — receber progress event
  - [ ] Enqueue BullMQ job em `queue:lesson-progress`
  - [ ] Payload: { userId, lessonId, tenantId, progressPercent, eventType }
  - [ ] Retornar 202 (async processing)
- [ ] Task 3: Implementar BullMQ worker para persistência (AC: #2)
  - [ ] Worker processa jobs e atualiza LessonProgress no PostgreSQL
  - [ ] Retry 3x com exponential backoff (1s, 2s, 4s)
  - [ ] Após 3 falhas → `queue:lesson-progress:failed`
  - [ ] Nunca atualizar progresso sincronamente no request path
- [ ] Task 4: Implementar recálculo de Module/Trail progress (AC: #3)
  - [ ] Ao completar lesson: recalcular ModuleProgress (completedLessons / totalLessons * 100)
  - [ ] Ao completar module: recalcular TrailProgress (completedModules / totalModules * 100)
  - [ ] Module completo = todas lessons completed
- [ ] Task 5: Emitir domain event content.trail.progress_updated (AC: #3)
  - [ ] Criar Zod schema para domain event em `packages/types`
  - [ ] Payload: { eventId, eventType, version: 1, tenantId, timestamp, data: { userId, trailId, progressPercent, previousPercent }, metadata: { correlationId } }
  - [ ] Snapshot test do schema (contract test)
  - [ ] Emitir via event bus / BullMQ
- [ ] Task 6: Criar componentes de progresso no frontend (AC: #4)
  - [ ] Progress bar component para trail/module
  - [ ] Status icons: circle (not started), half-circle (in progress), checkmark (completed)
  - [ ] "Continuar de onde parei" link → last accessed incomplete lesson
  - [ ] TanStack Query para fetching progress data
- [ ] Task 7: Integration test do pipeline completo (AC: #3)
  - [ ] lesson consumed → BullMQ job enqueued → progress persisted → module/trail recalculated → domain event emitted
  - [ ] Validar payload correto do domain event
- [ ] Task 8: Testes (AC: #1, #2, #3, #4, #5)
  - [ ] Snapshot test: domain event schema
  - [ ] Testes unitários: recálculo module/trail progress
  - [ ] Teste: retry 3x com backoff
  - [ ] Teste: jobs falhados movem para failed queue
  - [ ] RLS isolation tests: cross-tenant e cross-user
  - [ ] Test factories com tenantId e userId

## Dev Notes

- Progress é ASYNC (BullMQ) — nunca síncrono no request path (resilience)
- Domain event `content.trail.progress_updated` é contrato entre Content e Pastoral modules
- Snapshot test do domain event é OBRIGATÓRIO — prevenir breaking changes silenciosas
- "Continuar de onde parei" usa `lastAccessedAt` para determinar última aula
- Module completo = 100% das lessons completed (não parcial)
- NFR-I4: jobs falhados retidos para reprocessamento manual

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Core domains (Pastoral, Meetings, Content): Repository pattern
- Supporting subdomains: Service direto com Prisma
- Events: { eventId, eventType, version, tenantId, timestamp, data, metadata }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Story 8.1: CRUD Trilhas/Módulos/Aulas (schemas, content module)
- Story 8.2: Tipos de Conteúdo (contentUrl para lições)
- Epic 6: Radar Pastoral (consumer do domain event — futuro Story 6.9)

### Project Structure Notes
```
apps/api/src/modules/content/
  ├── progress/
  │   ├── progress.service.ts
  │   ├── progress.controller.ts
  │   └── progress.processor.ts     (BullMQ worker)
  ├── events/
  │   └── content-events.service.ts
  └── content.repository.ts         (inclui progress queries)
packages/types/src/content/
  ├── lesson-progress.schema.ts
  ├── lesson-status.enum.ts
  └── content-events.schema.ts
packages/types/__tests__/
  └── schemas.snapshot.test.ts  (adicionar domain event snapshot)
apps/api/test/rls/
  └── lesson-progress.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.3
- `docs/project-context.md` — Domain events format, BullMQ patterns, NFR-I4
- `docs/architecture.md` — Content bounded context, event-driven integration
