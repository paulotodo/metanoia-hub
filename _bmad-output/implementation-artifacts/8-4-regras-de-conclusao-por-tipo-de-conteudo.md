# Story 8.4: Regras de Conclusão por Tipo de Conteúdo

Status: ready-for-dev

## Story

As a Admin Tenant,
I want to configure how each content type determines lesson completion,
so that completion metrics reflect actual engagement rather than just page visits.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Criar Prisma schema para TenantContentConfig (AC: #4)
  - [ ] Model TenantContentConfig: tenantId (unique), videoThreshold (Int, default 90), docScrollThreshold (Int, default 80), allowManualVideoCompletion (Boolean, default false), allowManualDocCompletion (Boolean, default false)
  - [ ] @@map("tenant_content_config")
  - [ ] Migration com RLS policy
- [ ] Task 2: Implementar tracking de video watched intervals (AC: #1)
  - [ ] Criar hook `useVideoProgress` em `apps/web/src/hooks/`
  - [ ] Listener `timeupdate` a cada 5s
  - [ ] Manter array de watched intervals
  - [ ] Seeking reseta current interval start
  - [ ] Merge overlapping intervals para unique watched time
  - [ ] floor(uniqueWatched / totalDuration * 100) para percentage
- [ ] Task 3: Implementar tracking de document scroll + time (AC: #2)
  - [ ] Criar hook `useDocumentProgress` em `apps/web/src/hooks/`
  - [ ] Track scroll position (% scrolled)
  - [ ] Track time spent na página
  - [ ] Completion: scroll ≥ threshold AND time ≥ estimatedDurationMinutes
  - [ ] Se estimatedDuration null: apenas scroll threshold
- [ ] Task 4: Implementar manual completion para external_link (AC: #3)
  - [ ] Botão "Marcar como concluída" no external-link-view
  - [ ] Permitir líder marcar também
  - [ ] Registrar `completedBy: 'participant' | 'leader'` no progress
  - [ ] Adicionar campo completedBy ao LessonProgress schema
- [ ] Task 5: Implementar endpoint de configuração tenant (AC: #4)
  - [ ] `GET /api/v1/tenant-config/content` — ler config
  - [ ] `PATCH /api/v1/tenant-config/content` — atualizar config
  - [ ] Admin Tenant only
  - [ ] Validação: thresholds entre 50-100
  - [ ] Convention over configuration: defaults quando sem config
- [ ] Task 6: Garantir imutabilidade de completions (AC: #5)
  - [ ] Completed lessons NUNCA retroativamente alterados
  - [ ] Novas regras aplicam apenas para interações futuras
  - [ ] Validar no service layer antes de aplicar regras
- [ ] Task 7: Testes (AC: #1, #2, #3, #4, #5)
  - [ ] Boundary tests: 89% → NOT completed, 90% → completed, 89.5% floors to 89 → NOT completed
  - [ ] Teste: merge overlapping intervals
  - [ ] Teste: scroll 80% + time ≥ estimated → completed
  - [ ] Teste: scroll 80% sem estimatedDuration → completed
  - [ ] Teste: manual completion registra completedBy
  - [ ] Teste: config tenant override funciona
  - [ ] Teste: completion existente não muda com novas regras
  - [ ] RLS isolation tests para TenantContentConfig

## Dev Notes

- Video tracking: intervals array com merge para unique watched time
- floor() rounding — boundary é 90%, 89.5% floors para 89 = NOT completed
- TenantContentConfig é convention-over-configuration: sem config = defaults
- Completion é IMUTÁVEL — uma vez completed, nunca revertido por mudança de regra
- completedBy field permite distinguir completion automática vs manual
- Progress events via BullMQ (reutilizar queue:lesson-progress da Story 8.3)

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
- Story 8.1: CRUD Trilhas (Lesson schema)
- Story 8.2: Tipos de Conteúdo (video player, PDF viewer, external link)
- Story 8.3: Progresso Individual (LessonProgress, BullMQ queue)

### Project Structure Notes
```
apps/api/src/modules/content/
  ├── completion/
  │   └── completion-rules.service.ts
  └── config/
      ├── content-config.controller.ts
      └── content-config.service.ts
apps/web/src/hooks/
  ├── use-video-progress.ts
  └── use-document-progress.ts
packages/types/src/content/
  ├── completion-rules.schema.ts
  └── tenant-content-config.schema.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.4
- `docs/project-context.md` — Convention over configuration pattern
- `docs/architecture.md` — Content bounded context, tenant configuration
