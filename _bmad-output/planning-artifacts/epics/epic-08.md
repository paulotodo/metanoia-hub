## Epic 8: Trilhas, Conteúdo, Progresso, Relatórios & Busca

Trilhas com módulos e aulas multiformato (vídeo, texto rico, PDF/DOC, links externos). Upload via MinIO, visualização inline, progresso individual, regras de conclusão por tipo de conteúdo, acesso sequencial/livre, pré-requisitos, publicação/versionamento, catálogo tenant, relatório por trilha, exportação CSV e busca full-text. Content é Core Domain — usa repository pattern obrigatório. Quando este épico estiver completo, o semáforo do Epic 6 evolui automaticamente para incluir sinais de progresso de trilhas via domain events.

### Story 8.1: CRUD de Trilhas, Módulos & Aulas com Repository Pattern

As a Admin/Líder,
I want to create, edit, delete and reorder trails, modules within trails, and lessons within modules,
So that I can structure discipleship content in a clear hierarchy that participants can follow.

**Acceptance Criteria:**

**Given** the content module is set up at `apps/api/src/modules/content/`
**When** the module is initialized
**Then** it follows the Core Domain repository pattern with: `content.module.ts`, `content.controller.ts`, `content.service.ts`, `content.repository.ts`
**And** DTOs are created: `CreateTrailDto`, `UpdateTrailDto`, `CreateModuleDto`, `UpdateModuleDto`, `CreateLessonDto`, `UpdateLessonDto` in `dto/` folder, validated with Zod schemas from `packages/types`
**And** Zod schemas have snapshot tests in `packages/types/__tests__/schemas.snapshot.test.ts` — minimum 6 snapshots: CreateTrailDto, UpdateTrailDto, CreateModuleDto, UpdateModuleDto, CreateLessonDto, UpdateLessonDto

**Given** I am authenticated as Admin or Líder within my tenant
**When** I create a trail via `POST /api/v1/trails`
**Then** a new `Trail` record is created with: `id` (UUID v7), `tenantId` (auto-injected via Prisma extension), `name`, `description`, `status` (default: `draft`), `createdBy`, `createdAt`, `updatedAt`
**And** the Prisma model uses `@@map("trails")` with fields using `@map("snake_case")`
**And** RLS policy `rls_trails_tenant_isolation` ensures queries are scoped to my tenant_id
**And** the response follows the API contract: `{ "data": { ...trail }, "meta": null }` with status 201

**Given** a trail exists in my tenant
**When** I create a module via `POST /api/v1/trails/:trailId/modules`
**Then** a new `Module` record is created with: `id` (UUID v7), `trailId`, `tenantId`, `name`, `order` (auto-increment within trail), `createdAt`, `updatedAt`
**And** the `order` field supports reordering via `PATCH /api/v1/trails/:trailId/modules/reorder` accepting an array of module IDs
**And** the reorder endpoint returns 422 if the array contains duplicate IDs, IDs not belonging to this trail, or a count mismatch with existing modules

**Given** a module exists in my tenant
**When** I create a lesson via `POST /api/v1/trails/:trailId/modules/:moduleId/lessons`
**Then** a new `Lesson` record is created with: `id` (UUID v7), `moduleId`, `tenantId`, `name`, `contentType` (enum: `video`, `rich_text`, `pdf_doc`, `external_link`), `contentUrl` (nullable — set in Story 8.2), `order`, `estimatedDurationMinutes`, `createdAt`, `updatedAt`
**And** the `order` field supports reordering via `PATCH /api/v1/trails/:trailId/modules/:moduleId/lessons/reorder`
**And** the same 422 validation rules from module reorder apply to lesson reorder (duplicate IDs, wrong parent, count mismatch)

**Given** I try to access a trail from another tenant
**When** the query executes
**Then** RLS blocks the access and returns 404 (not 403, to prevent tenant enumeration)
**And** RLS isolation tests in `apps/api/test/rls/` validate cross-tenant isolation for trails, modules, and lessons

**Given** I delete a trail via `DELETE /api/v1/trails/:trailId`
**When** the trail has modules and lessons
**Then** soft-delete is applied (field `deletedAt`) — cascade soft-deletes modules and lessons
**And** the response is 204 (no body)

### Story 8.2: Tipos de Conteúdo, Upload & Visualização Inline

As a Admin/Líder,
I want to upload content files (video, PDF/DOC) and reference external links and rich text for lessons,
So that participants can consume discipleship content directly in the platform without downloading files.

**Acceptance Criteria:**

**Given** a lesson exists with `contentType: video`
**When** I upload a video file via `POST /api/v1/content/upload`
**Then** the file is stored in MinIO under bucket `metanoia-storage` with key `content/{tenantId}/{trailId}/{lessonId}/{filename}`
**And** the storage policy is `permanent` (content is retained indefinitely, not subject to 90-day expiration)
**And** the `Lesson.contentUrl` is updated with the MinIO object key (not a signed URL — URLs are signed on read)
**And** file metadata is stored: `originalName`, `mimeType`, `sizeBytes`, `uploadedBy`, `uploadedAt`
**And** all content records store indexable metadata: `title`, `description`, `tags` (text array — used for full-text search in Story 8.8)

**Given** a lesson has `contentType: video` and a valid `contentUrl`
**When** a participant navigates to the lesson page
**Then** a video player is rendered inline using native `<video>` element with signed MinIO URL generated via `storage.service.getSignedUrl(objectKey, expiration)` from Epic 1 storage module (expiration: 4 hours)
**And** the video player is visible within 2 seconds of page load (NFR-P6) — verified via Playwright `page.waitForSelector('video', { state: 'visible' })` with 2000ms timeout in E2E tests
**And** video playback begins within 3 seconds on stable network (NFR-P7) — verified via Playwright `video.evaluate(v => v.readyState >= 3)` assertion with 3000ms timeout

**Given** a lesson has `contentType: pdf_doc` and a valid `contentUrl`
**When** a participant navigates to the lesson page
**Then** the document is rendered inline using a PDF viewer component (no forced download)
**And** the document is legible and navigable within 2 seconds (NFR-P8)

**Given** a lesson has `contentType: rich_text`
**When** the Admin/Líder edits the lesson
**Then** a rich text editor is available for content authoring (bold, italic, headings, lists, links, images)
**And** the rendered content is stored as HTML in the `contentBody` field (no external file — stored in DB)

**Given** a lesson has `contentType: external_link`
**When** a participant navigates to the lesson
**Then** the external URL is displayed with a preview card and an "Abrir em nova aba" button
**And** the link opens in a new tab with `rel="noopener noreferrer"`

**Given** the trail page loads with all content types
**When** the page renders
**Then** the full page loads within 2.5 seconds (NFR-P5)
**And** `content.repository.ts` handles all queries with N+1 prevention (eager loading modules + lessons in a single query)

### Story 8.3: Progresso Individual & Percentual de Conclusão

As a Participante,
I want my progress to be tracked automatically as I consume trail content,
So that I can see how far I've advanced and resume where I left off.

**Acceptance Criteria:**

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

### Story 8.4: Regras de Conclusão por Tipo de Conteúdo

As a Admin Tenant,
I want to configure how each content type determines lesson completion,
So that completion metrics reflect actual engagement rather than just page visits.

**Acceptance Criteria:**

**Given** a lesson has `contentType: video`
**When** the participant watches the video
**Then** the frontend tracks video playback progress via `timeupdate` events fired every 5 seconds
**And** the frontend maintains an array of watched intervals (e.g., `[{start: 0, end: 30}, {start: 45, end: 90}]`) — seeking resets the current interval start, only continuous playback extends intervals
**And** unique watched time is calculated by merging overlapping intervals and summing total unique seconds
**And** the lesson is marked as `completed` when `floor(uniqueWatchedSeconds / totalDurationSeconds * 100) >= 90` (integer percentage, floor rounding)
**And** the watched percentage is persisted incrementally via BullMQ jobs in `queue:lesson-progress`
**And** boundary tests validate: 89% → NOT completed, 90% → completed, 89.5% floors to 89 → NOT completed

**Given** a lesson has `contentType: pdf_doc` or `rich_text`
**When** the participant reads the document
**Then** the frontend tracks scroll position (percentage of document scrolled) and time spent
**And** the lesson is marked as `completed` when: scroll ≥ 80% of document AND time spent ≥ estimated reading time (field `estimatedDurationMinutes` on Lesson)
**And** if `estimatedDurationMinutes` is not set, only scroll ≥ 80% is required

**Given** a lesson has `contentType: external_link`
**When** the participant clicks the link
**Then** the lesson can only be completed via manual marking (participant clicks "Marcar como concluída" or leader marks it)
**And** a manual completion records `completedBy: 'participant' | 'leader'` in the progress record

**Given** I am an Admin Tenant
**When** I access tenant configuration settings
**Then** I can override default completion rules per content type for my tenant:
  - Video threshold: default 90%, configurable 50%-100%
  - Document scroll threshold: default 80%, configurable 50%-100%
  - Allow/disallow manual completion for video and document types
**And** the configuration is stored in `TenantContentConfig` table with `tenantId` (unique)
**And** the default rules apply when no tenant-specific config exists (convention over configuration)

**Given** completion rules change for a tenant
**When** existing progress records exist
**Then** existing completed lessons are NOT retroactively changed (completion is immutable once recorded)
**And** only future lesson interactions use the new rules

### Story 8.5: Acesso Sequencial & Pré-requisitos entre Módulos e Aulas

As a Admin/Líder,
I want to configure whether modules and lessons must be completed in sequence or can be accessed freely,
So that I can enforce learning paths or allow flexible exploration depending on the content.

**Acceptance Criteria:**

**Given** I am editing a trail
**When** I configure the trail's access mode
**Then** I can choose between: `sequential` (modules must be completed in order) or `free` (any module accessible)
**And** the setting is stored as `accessMode` field on the `Trail` model (enum: `sequential`, `free`, default: `free`)

**Given** a trail has `accessMode: sequential`
**When** a participant tries to access Module 3
**Then** access is granted only if Module 2 has `status: completed` in the participant's `ModuleProgress`
**And** if Module 2 is not complete, the API returns 403 with message: "Complete o módulo anterior para desbloquear este conteúdo"
**And** the UI shows locked modules with a lock icon and a tooltip explaining the prerequisite

**Given** a module has lessons
**When** the module has `lessonAccessMode: sequential` (configurable per module, independent of trail-level setting)
**Then** lessons within the module must be completed in order
**And** the same locking logic applies at lesson level

**Given** I configure prerequisites between modules
**When** I set Module C to require Module A and Module B as prerequisites via `PATCH /api/v1/trails/:trailId/modules/:moduleId/prerequisites`
**Then** a `ModulePrerequisite` join table stores the relationships
**And** the API validates that prerequisites don't create circular dependencies (returns 422 with explanation if detected)
**And** a participant can only access Module C when both A and B are completed

**Given** a trail has `accessMode: free`
**When** a participant navigates the trail
**Then** all modules are accessible regardless of completion status
**And** lesson-level `lessonAccessMode` within each module is still respected independently

### Story 8.6: Publicação, Versionamento & Catálogo Tenant

As a Admin/Líder,
I want to manage trail content through a draft-to-published workflow and make trails available as a tenant-wide catalog,
So that content quality is controlled before participant access and trails can be shared across multiple groups.

**Acceptance Criteria:**

**Given** I create a trail (Story 8.1)
**When** the trail is created
**Then** it starts with `status: draft` — invisible to participants
**And** only users with role Admin or Líder (or future Editor de Conteúdo) can view draft trails

**Given** a trail is in `draft` status
**When** I publish it via `POST /api/v1/trails/:trailId/publish`
**Then** the `status` changes to `published` and a `version` number is set (starts at 1)
**And** `publishedAt` and `publishedBy` fields are recorded
**And** the trail becomes visible and accessible to participants in associated groups
**And** a domain event `content.trail.published` is emitted with: `{ eventId, eventType, version: 1, tenantId, timestamp, data: { trailId, trailVersion, publishedBy } }`

**Given** a published trail needs updates
**When** I edit the trail content (add/modify modules, lessons)
**Then** edits are made on a new draft version (participants continue seeing the current published version)
**And** when I re-publish, the `version` is incremented and the new content becomes live
**And** previous versions are retained in a `TrailVersion` table for audit/rollback
**And** publishing a new version does NOT invalidate existing participant progress — `LessonProgress` records reference `lessonId` (stable UUID v7), not the trail version number. If lessons are removed in a new version, orphaned progress records are soft-archived (not deleted)
**And** a regression test validates: publish v2 with modified lesson structure → participant progress from v1 is NOT lost, NOT corrupted, and correctly displayed

**Given** I want to make a trail available across my tenant
**When** I add the trail to the tenant catalog via `POST /api/v1/trails/:trailId/catalog`
**Then** the trail is flagged as `catalogVisible: true`
**And** it appears in the tenant-wide trail catalog endpoint: `GET /api/v1/trails/catalog`
**And** any Admin/Líder in the tenant can associate it with their groups (N:N relationship via `GroupTrail` join table)

**Given** a trail is associated with multiple groups (Epic 4, Story 4.4 integration)
**When** I query trail associations
**Then** the `GroupTrail` table stores: `groupId`, `trailId`, `assignedAt`, `assignedBy`
**And** participants see the trail in each group context they belong to
**And** progress is tracked per-participant (not per-group) — a participant in multiple groups sees the same progress

**Given** trail catalog operations
**When** any query is executed
**Then** all operations are scoped by tenant via RLS — no cross-tenant catalog leakage

### Story 8.7: Relatório por Trilha & Exportação CSV

As a Líder/Admin,
I want to view trail completion reports with per-participant metrics and export them as CSV,
So that I can monitor group progress and share reports with church leadership.

**Acceptance Criteria:**

**Given** I am a Líder with a group that has trails assigned
**When** I access `GET /api/v1/reports/trails/:trailId`
**Then** I see a report with:
  - Trail name, total modules, total lessons
  - Per-participant row: name, overall progress %, modules completed, lessons completed, last activity date, status (not started / in progress / completed)
  - Aggregated metrics: average completion %, participants who completed, participants who haven't started
**And** the report is paginated using `{ "data": [...], "meta": { "page", "perPage", "total", "totalPages" } }`
**And** results are filterable by: status (not_started, in_progress, completed), date range (lastActivityAfter, lastActivityBefore)
**And** all data is scoped to my tenant and my groups (Líder sees only their groups; Admin sees all groups in tenant)

**Given** I want to export the report
**When** I request `GET /api/v1/reports/trails/:trailId/export?format=csv`
**Then** the API returns a CSV file with Content-Type `text/csv` and Content-Disposition `attachment; filename="trilha-{trailName}-{date}.csv"`
**And** the CSV includes headers in Portuguese: "Participante", "Progresso (%)", "Módulos Concluídos", "Aulas Concluídas", "Última Atividade", "Status"
**And** the CSV uses UTF-8 with BOM for correct character display in Excel
**And** for large datasets (> 1000 participants), the export is processed asynchronously via BullMQ job in `queue:reports` and the API returns 202 with a `jobId`
**And** the client polls `GET /api/v1/reports/jobs/:jobId` for status (`processing`, `completed`, `failed`) — when completed, the response includes a signed download URL (valid for 1 hour). This polling approach works without Epic 14 notifications; when Epic 14 is implemented, an in-app notification is added as enhancement

**Given** I am an Admin
**When** I access `GET /api/v1/reports/trails` (without trailId)
**Then** I see a summary of all trails in my tenant: trail name, total participants, average progress, completion rate
**And** I can drill down into any trail for the detailed per-participant report

### Story 8.8: Busca Full-Text por Conteúdo

As a Participante/Líder/Admin,
I want to search for content across trails, modules and lessons using free-text search,
So that I can quickly find relevant discipleship material without browsing through the entire trail hierarchy.

**Acceptance Criteria:**

**Given** the content database has trails, modules, and lessons with populated `title`, `description`, and `tags` fields
**When** a Prisma migration is applied
**Then** a `tsvector` column `search_vector` is added to the `lessons` table (and optionally `trails` and `modules`)
**And** a PostgreSQL trigger automatically updates `search_vector` on INSERT and UPDATE using `to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))`
**And** a GIN index `idx_lessons_search_vector` is created on the `search_vector` column
**And** the migration includes `CREATE EXTENSION IF NOT EXISTS unaccent;` before creating the tsvector infrastructure
**And** the migration is a raw SQL migration (not Prisma schema-only, since tsvector + trigger + extension require raw SQL)
**And** the migration is wrapped in a transaction. The rollback migration drops the GIN index, trigger, tsvector column, and extension cleanly (in reverse order)
**And** soft-deleted records (`deletedAt IS NOT NULL`) are excluded from the tsvector trigger — the trigger includes a `WHERE deletedAt IS NULL` condition, preventing "ghost" results in search

**Given** I am authenticated and search via `GET /api/v1/search?q={term}`
**When** I enter a search term
**Then** results are returned from lessons matching the `ts_query` against `search_vector`
**And** results include: lesson title, trail name, module name, content type, and a text snippet with highlighted match
**And** results are ranked by `ts_rank` relevance score
**And** results are scoped to my tenant via RLS (no cross-tenant results)
**And** the search endpoint responds within 500ms for up to 10,000 lessons per tenant

**Given** I search with Portuguese diacritics (e.g., "oração" vs "oracao")
**When** the search executes
**Then** both forms return the same results (the `portuguese` text search configuration handles diacritics via `unaccent` extension installed in the migration)
**And** partial terms are supported via prefix matching (e.g., "disc" matches "discipulado")
**And** when no matches are found, the API returns an empty array `{ "data": [], "meta": { "total": 0 } }` (not an error)

**Given** I search for content
**When** a trail is in `draft` status
**Then** draft content does NOT appear in search results for Participantes
**And** Admin/Líder can see draft content in results (with a "Rascunho" badge)

### Story 8.9: TrailPlaylist, Skeletons & Performance UX

As a Participante,
I want a playlist-style view of trail content with smooth loading states,
So that I can navigate lessons intuitively and never see blank screens while content loads.

**Acceptance Criteria:**

**Given** I navigate to a trail page
**When** the page renders
**Then** a `TrailPlaylist` component displays the trail structure as a playlist sidebar:
  - Modules as collapsible sections with title and completion percentage
  - Lessons within each module as list items with: title, content type icon (video/doc/link), duration estimate, completion status (checkmark / in-progress / locked)
  - Overall trail progress bar at the top
**And** the currently active lesson is highlighted with `brand-teal` background
**And** clicking a lesson loads it in the main content area (right panel on desktop, full-screen on mobile)
**And** the component uses the `Consumo` experience density (padding 20-24px, radius 12px) per UX-DR03

**Given** the trail page is loading
**When** the API response is pending
**Then** skeleton placeholders are shown for: playlist sidebar (3 module blocks with 3 lesson lines each), main content area (video/document placeholder), and progress bar
**And** skeletons animate with a subtle pulse (using `motion-safe:animate-pulse`)
**And** no Cumulative Layout Shift (CLS) occurs when real content replaces skeletons

**Given** the trail page has modules below the fold
**When** the page loads
**Then** only above-the-fold modules load their lesson details immediately
**And** below-the-fold modules use lazy loading (Intersection Observer) to defer lesson data fetching
**And** heavy components (`TimelineCuidado`, `TelaReentry` from other epics) use `next/dynamic` for dynamic imports

**Given** I am on a mobile device (< lg breakpoint)
**When** I view the trail
**Then** the playlist shows as a collapsible bottom sheet or top accordion (not sidebar)
**And** tapping a lesson opens the content full-screen with a "back to playlist" button
**And** touch targets are ≥ 44px for all interactive elements

**Given** all performance optimizations are in place
**When** the trail page loads
**Then** total page load is ≤ 2.5 seconds (NFR-P5)
**And** TanStack Query is used for data fetching in Client Components with stale-while-revalidate (staleTime: 5 minutes for trail structure, 30 seconds for progress data)
**And** the `TrailPlaylist` component passes jest-axe accessibility tests
**And** keyboard navigation works: arrow keys to navigate lessons, Enter to select, Escape to collapse module

**Prerequisite:** Stories 8.1-8.8 must be complete. This story integrates CRUD (8.1), content viewing (8.2), progress (8.3), completion status (8.4), sequential locking (8.5), and draft/published filtering (8.6).

### Story 8.10: Tela "Minhas Trilhas" — Listagem de Trilhas do Participante

As a Participante,
I want to see a listing of all trails available to me with my progress on each,
So that I can discover content assigned to my groups and choose what to study next.

**Acceptance Criteria:**

**Given** I am a participant with group memberships that have trails associated
**When** I navigate to the "Trilhas" tab (from NavigationConfig — Epic 1, Story 1.8)
**Then** I see a listing page with trail cards, each showing:
  - Trail name and description (truncated to 2 lines)
  - Number of modules and total lessons
  - My progress bar with completion percentage
  - Status badge: "Não Iniciada", "Em Andamento", or "Concluída"
  - Last activity date (if started)
**And** trails are sorted by: in-progress first (by last activity, descending), then not-started, then completed
**And** only `published` trails are shown (draft trails are hidden from participants)
**And** the listing is paginated with infinite scroll (10 trails per page, TanStack Query with `useInfiniteQuery`)

**Given** I click on a trail card
**When** the trail page loads
**Then** I am taken to the TrailPlaylist view (Story 8.9) for that trail
**And** if I have progress, the playlist opens on my last accessed lesson ("Continuar de onde parei" from Story 8.3)

**Given** I have no trails assigned (empty state)
**When** the listing page loads
**Then** an empty state is displayed with pastoral vocabulary: "Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado."
**And** the empty state uses the `EmptyState` component pattern (consistent with Epic 7 onboarding patterns)

**Given** the listing page is loading
**When** the API response is pending
**Then** skeleton placeholders show 3 trail card outlines with pulse animation (UX-DR27)
**And** no CLS when real cards replace skeletons

**Given** the listing page renders
**When** all content is loaded
**Then** the page load is ≤ 2.5 seconds (NFR-P5)
**And** the page uses `Consumo` experience density (padding 20-24px, radius 12px) per UX-DR03
**And** all trail cards have touch targets ≥ 44px on mobile
**And** the listing page passes jest-axe accessibility tests

---

