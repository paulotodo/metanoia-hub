# Story 8.2: Tipos de Conteúdo, Upload & Visualização Inline

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to upload content files (video, PDF/DOC) and reference external links and rich text for lessons,
so that participants can consume discipleship content directly in the platform without downloading files.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Implementar upload endpoint (AC: #1)
  - [ ] `POST /api/v1/content/upload` — multipart file upload
  - [ ] Armazenar em MinIO bucket `metanoia-storage` key `content/{tenantId}/{trailId}/{lessonId}/{filename}`
  - [ ] Storage policy: permanent (sem expiração)
  - [ ] Atualizar Lesson.contentUrl com MinIO object key
  - [ ] Armazenar metadata: originalName, mimeType, sizeBytes, uploadedBy, uploadedAt
- [ ] Task 2: Adicionar campos de metadata ao Lesson (AC: #1)
  - [ ] Prisma migration: adicionar contentBody (nullable Text), tags (String[])
  - [ ] Criar model ContentMetadata ou adicionar campos inline
  - [ ] title, description, tags (text array) para full-text search (Story 8.8)
- [ ] Task 3: Implementar video player inline (AC: #2)
  - [ ] Criar `apps/web/src/components/content/video-player.tsx`
  - [ ] Native `<video>` element com signed MinIO URL
  - [ ] Signed URL via `storage.service.getSignedUrl(objectKey, 4h)`
  - [ ] Endpoint `GET /api/v1/content/signed-url/:lessonId` para gerar URL
  - [ ] NFR-P6: visível em 2s, NFR-P7: playback em 3s
- [ ] Task 4: Implementar PDF viewer inline (AC: #3)
  - [ ] Criar `apps/web/src/components/content/pdf-viewer.tsx`
  - [ ] Usar library como `react-pdf` ou iframe com signed URL
  - [ ] Sem download forçado — visualização inline
  - [ ] NFR-P8: legível em 2s
- [ ] Task 5: Implementar rich text editor (AC: #4)
  - [ ] Criar `apps/web/src/components/content/rich-text-editor.tsx`
  - [ ] Features: bold, italic, headings, lists, links, images
  - [ ] Usar library como TipTap ou Lexical
  - [ ] Salvar como HTML no campo contentBody
- [ ] Task 6: Implementar external link view (AC: #5)
  - [ ] Criar `apps/web/src/components/content/external-link-view.tsx`
  - [ ] Preview card com URL
  - [ ] Botão "Abrir em nova aba" com `rel="noopener noreferrer"`
- [ ] Task 7: Otimizar queries N+1 (AC: #6)
  - [ ] content.repository.ts: eager loading modules + lessons em single query
  - [ ] Prisma include/select para prevenir N+1
  - [ ] Full page load ≤ 2.5s (NFR-P5)
- [ ] Task 8: Testes (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Teste: upload armazena no MinIO com key correta
  - [ ] Teste: signed URL gerada com 4h expiration
  - [ ] E2E Playwright: video visível em 2s (NFR-P6)
  - [ ] E2E Playwright: video playback em 3s (NFR-P7)
  - [ ] Teste: PDF renderizado inline
  - [ ] Teste: rich text salvo como HTML
  - [ ] Teste: external link abre em nova aba
  - [ ] Teste: N+1 prevention em repository queries

## Dev Notes

- MinIO storage key pattern: `content/{tenantId}/{trailId}/{lessonId}/{filename}`
- URLs são SIGNED ON READ — nunca armazenar signed URLs no DB
- Signed URL expiration: 4 horas
- Rich text armazenado como HTML no DB (contentBody) — sem arquivo externo
- N+1 prevention é CRÍTICO — eager loading obrigatório no repository
- NFRs de performance testados via Playwright E2E

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
- Story 8.1: CRUD de Trilhas/Módulos/Aulas (schema, content module)
- Epic 1: Storage module (MinIO, storage.service)

### Project Structure Notes
```
apps/api/src/modules/content/
  ├── upload/
  │   ├── upload.controller.ts
  │   └── upload.service.ts
  └── signed-url/
      └── signed-url.controller.ts
apps/web/src/components/content/
  ├── video-player.tsx
  ├── pdf-viewer.tsx
  ├── rich-text-editor.tsx
  └── external-link-view.tsx
apps/web/e2e/
  └── content-performance.e2e-spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.2
- `docs/project-context.md` — MinIO storage, NFR-P5/P6/P7/P8
- `docs/architecture.md` — Storage module, Content bounded context
