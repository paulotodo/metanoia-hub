# Story 16.6: Legendas & Transcrição de Vídeo (NFR-A6)

Status: ready-for-dev

## Story

As a content creator (Líder or Admin),
I want to upload subtitles for video content and have them displayed to participants,
So that video content is accessible to users who are deaf, hard of hearing, or in sound-sensitive environments.

## Acceptance Criteria

**Given** a content creator edits a video module in the trail editor
**When** they access the subtitle section
**Then** an upload area accepts subtitle files in VTT format (WebVTT — the web standard, NOT SRT)
**And** the upload validates: file extension `.vtt`, file size <= 1MB, valid WebVTT syntax (parser validates `WEBVTT` header and at least one cue)
**And** if validation fails, a descriptive error is shown: "Arquivo inválido. Use formato WebVTT (.vtt) com tamanho máximo de 1MB."
**And** cue text content is sanitized on upload: all HTML tags are stripped (WebVTT allows `<b>`, `<i>`, `<u>`, `<c>` tags but they can be abused for XSS via `<c.class>` or malformed tags) — only plain text is stored
**And** multiple language tracks can be uploaded per video, each with a `lang` label (e.g., "Português", "English", "Libras")

**Given** a subtitle file is uploaded successfully
**When** it is stored
**Then** the file is uploaded to MinIO/S3 under `{tenantId}/subtitles/{moduleId}/{lang}.vtt`
**And** a record is created in `module_subtitles` table: `{ module_id, tenant_id, language, file_key, uploaded_by, created_at }`
**And** the subtitle file URL is a signed URL (1h expiry) served via `GET /api/v1/modules/{moduleId}/subtitles/{lang}`
**And** tenant isolation is enforced via RLS — a tenant cannot access another tenant's subtitle files

**Given** a participant views a video module that has subtitles
**When** the Plyr player (defined in Epic 15 Story 15.4) loads
**Then** subtitle tracks are loaded as `<track kind="subtitles" src="{vttUrl}" srclang="{lang}" label="{langLabel}">`
**And** the first available track matching the user's browser language is enabled by default (if no match, subtitles are off by default)
**And** the user can toggle subtitles on/off and switch between language tracks via the player's CC button
**And** subtitle styling uses platform defaults (white text, semi-transparent dark background) — no custom CSS overrides that could break readability

**Given** a participant wants to read the full transcript
**When** they click "Ver transcrição" below the video player
**Then** the WebVTT file is parsed and displayed as a scrollable text block with timestamps
**And** each cue is a clickable element: clicking a timestamp seeks the video to that position
**And** the transcript is searchable via a text input: "Buscar na transcrição" with highlight of matching terms
**And** the transcript section is accessible: `role="region"` with `aria-label="Transcrição do vídeo"`

**Given** a video module has NO subtitles uploaded
**When** the module is displayed
**Then** no CC button appears in the player (clean UI — don't show a button that does nothing)
**And** an admin-facing indicator (not visible to participants) flags: "Este módulo não possui legendas" in the content management list, similar to the `has_missing_alt_text` flag from Epic 15

**Given** a video module with subtitles is deleted (soft-delete)
**When** the module enters soft-delete state
**Then** the subtitle records in `module_subtitles` are soft-deleted alongside the module (cascade)
**And** after the soft-delete retention period (30 days), a cleanup job hard-deletes the `module_subtitles` records AND the VTT files from MinIO/S3 (`{tenantId}/subtitles/{moduleId}/`)
**And** no orphan VTT files remain in storage after cleanup

## Tasks / Subtasks

- [ ] Task 1: Create `module_subtitles` table via Prisma migration (AC: #2)
  - [ ] Define model: `id` (UUID v7), `module_id`, `tenant_id`, `language`, `file_key`, `uploaded_by`, `created_at`, `deleted_at` (soft delete)
  - [ ] Add RLS policy for tenant_id isolation
  - [ ] Add unique index on `(module_id, tenant_id, language)`
  - [ ] Map with `@@map("module_subtitles")`
- [ ] Task 2: Implement subtitle upload with validation (AC: #1)
  - [ ] Create `POST /api/v1/modules/{moduleId}/subtitles` endpoint
  - [ ] Validate: `.vtt` extension, size <= 1MB, valid WebVTT syntax (header + at least one cue)
  - [ ] Sanitize cue text: strip ALL HTML tags (prevent XSS)
  - [ ] Support multiple language tracks per video
  - [ ] Upload sanitized file to MinIO: `{tenantId}/subtitles/{moduleId}/{lang}.vtt`
- [ ] Task 3: Implement subtitle serving endpoint (AC: #2)
  - [ ] `GET /api/v1/modules/{moduleId}/subtitles/{lang}` — return signed URL (1h expiry)
  - [ ] `GET /api/v1/modules/{moduleId}/subtitles` — list available tracks
  - [ ] Enforce RLS tenant isolation
- [ ] Task 4: Integrate subtitles with Plyr player (AC: #3)
  - [ ] Load subtitle tracks as `<track kind="subtitles">` elements
  - [ ] Auto-enable track matching browser language (off if no match)
  - [ ] Toggle CC on/off and switch between tracks
  - [ ] Platform default subtitle styling (no custom CSS overrides)
  - [ ] Hide CC button when no subtitles available
- [ ] Task 5: Build transcript viewer (AC: #4)
  - [ ] Parse WebVTT file into cue list with timestamps
  - [ ] Display as scrollable text block
  - [ ] Clickable timestamps → seek video to position
  - [ ] Search input "Buscar na transcrição" with highlight
  - [ ] Accessible: `role="region"`, `aria-label="Transcrição do vídeo"`
- [ ] Task 6: Implement admin indicator for missing subtitles (AC: #5)
  - [ ] Flag modules without subtitles in content management list
  - [ ] Similar to `has_missing_alt_text` pattern from Epic 15
- [ ] Task 7: Implement cascade soft-delete and cleanup (AC: #6)
  - [ ] Soft-delete subtitle records when module is soft-deleted
  - [ ] Cleanup job: after 30-day retention, hard-delete records AND VTT files from MinIO
  - [ ] Verify no orphan files remain
- [ ] Task 8: Write tests (AC: all)
  - [ ] Upload test: valid VTT → success, invalid format → error, oversized → error
  - [ ] XSS test: VTT with `<script>` in cue text → verify tags stripped
  - [ ] Plyr integration: video with 2 tracks → verify `<track>` elements → toggle CC
  - [ ] Transcript: parse VTT → verify cues → click timestamp → verify seek
  - [ ] Search: search term → verify highlights
  - [ ] RLS test: tenant A uploads → tenant B cannot access
  - [ ] Cascade delete: soft-delete module → verify subtitles soft-deleted → advance 30 days → verify VTT files removed
  - [ ] E2E: upload → view as participant → enable CC → view transcript → search → click timestamp

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Security
- WebVTT cue text sanitized: ALL HTML tags stripped on upload (XSS prevention)
- Signed URLs for subtitle files (1h expiry)

### Dependencies
- Epic 8 (trails — content modules, video player base)
- Epic 15 Story 15.4 (Plyr video player — subtitles integrate with it)
- MinIO/S3 for file storage

### Project Structure Notes
- Backend: `apps/api/src/modules/content/subtitles/`
  - `subtitle.service.ts`
  - `subtitle.controller.ts`
  - `vtt-parser.ts` — WebVTT validation and sanitization
- Migration: `apps/api/prisma/migrations/YYYYMMDD_add_module_subtitles/`
- Frontend: `apps/web/components/content/transcript-viewer.tsx`
- Frontend: `apps/web/components/content/video-player.tsx` (extend with subtitle support)
- MinIO path: `{tenantId}/subtitles/{moduleId}/{lang}.vtt`
- Shared types: `packages/types/src/content/subtitle.ts`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-16.md` (Story 16.6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
