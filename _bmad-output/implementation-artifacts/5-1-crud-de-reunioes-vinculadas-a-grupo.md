# Story 5.1: CRUD de Reuniões Vinculadas a Grupo

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to create, edit, cancel and manage meetings linked to a group,
so that I can schedule and control discipleship meetings.

## Acceptance Criteria

**Given** I am authenticated as Admin or Líder
**When** I create a new meeting for a group
**Then** the meeting is created with the schema: `id` (UUID v7), `tenant_id`, `group_id` (FK), `title`, `scheduled_at` (ISO 8601), `duration_minutes`, `status` (enum: `scheduled`, `in_progress`, `completed`, `cancelled`), `provider_room_id` (string, nullable — preenchido ao iniciar reunião), `created_by`, `created_at`, `updated_at`
**And** RLS policies ensure the meeting is only visible within the tenant
**And** the API returns 201 with the created meeting data

**Given** I am Líder of the meeting's group
**When** I start the meeting
**Then** the status changes to `in_progress`, a LiveKit room is created via adapter, and `provider_room_id` is populated
**And** when I end the meeting, status changes to `completed` and the room is closed

**Given** the meeting is displayed in the UI
**When** a participant views the `MeetingCard` component (UX-DR13)
**Then** the card shows date, time, status and a 1-tap entry button
**And** the entry button calls an endpoint that generates a LiveKit access token on-demand and redirects to the room

**Given** meetings exist in my group
**When** I list meetings
**Then** I see a paginated list filterable by status and group

## Tasks / Subtasks

- [ ] Task 1: Criar Prisma schema para `meetings` (AC: #1)
  - [ ] Definir model Meeting com campos: id, tenant_id, group_id, title, scheduled_at, duration_minutes, status, provider_room_id, created_by, created_at, updated_at
  - [ ] Usar `@@map("meetings")` e `@map("snake_case")` para cada campo
  - [ ] UUID v7 via `uuidv7()` — nunca `@default(uuid())`
  - [ ] Criar enum `MeetingStatus` com valores: scheduled, in_progress, completed, cancelled
  - [ ] Criar migration com RLS policy `rls_meetings_tenant_isolation`
- [ ] Task 2: Criar módulo Meetings no NestJS (AC: #1, #2, #4)
  - [ ] Criar `apps/api/src/modules/meetings/meetings.module.ts`
  - [ ] Criar `meetings.controller.ts` com endpoints REST
  - [ ] Criar `meetings.service.ts` com lógica de negócio
  - [ ] Criar `meetings.repository.ts` (Core Domain — Repository Pattern obrigatório)
  - [ ] Implementar DTOs com Zod: `CreateMeetingDto`, `UpdateMeetingDto` em `packages/types`
- [ ] Task 3: Implementar endpoints CRUD (AC: #1, #4)
  - [ ] `POST /api/v1/meetings` — criar reunião (201)
  - [ ] `GET /api/v1/meetings` — listar com paginação, filtros status/group
  - [ ] `GET /api/v1/meetings/:id` — detalhe
  - [ ] `PATCH /api/v1/meetings/:id` — editar
  - [ ] `DELETE /api/v1/meetings/:id` — cancelar (soft delete ou status cancelled)
- [ ] Task 4: Implementar start/end meeting (AC: #2)
  - [ ] `POST /api/v1/meetings/:id/start` — status → in_progress, criar room via VideoProviderAdapter
  - [ ] `POST /api/v1/meetings/:id/end` — status → completed, fechar room
- [ ] Task 5: Implementar endpoint de token de acesso (AC: #3)
  - [ ] `POST /api/v1/meetings/:id/join` — gerar LiveKit access token on-demand
- [ ] Task 6: Criar componente `MeetingCard` no frontend (AC: #3)
  - [ ] Criar `apps/web/src/components/meetings/meeting-card.tsx`
  - [ ] Exibir data, hora, status e botão de entrada 1-tap
  - [ ] Integrar com endpoint de join para gerar token e redirecionar
- [ ] Task 7: Criar tela de listagem de reuniões (AC: #4)
  - [ ] Criar página `apps/web/src/app/(authenticated)/meetings/page.tsx`
  - [ ] Usar TanStack Query (Client Component) para fetching
  - [ ] Implementar filtros por status e grupo
  - [ ] Paginação com meta { page, perPage, total, totalPages }
- [ ] Task 8: Testes (AC: #1, #2, #3, #4)
  - [ ] Testes unitários co-located `meetings.service.spec.ts`
  - [ ] RLS isolation tests em `apps/api/test/rls/meetings.rls.spec.ts`
  - [ ] Snapshot tests dos Zod schemas em `packages/types/__tests__/`
  - [ ] Test factories com tenantId

## Dev Notes

- **Meetings é Core Domain** — obrigatório usar Repository Pattern (`meetings.repository.ts`)
- LiveKit integration via adapter pattern (Story 5.2) — esta story cria o CRUD, a integração real é na 5.2
- NestJS 11.1.17, Prisma v7, PostgreSQL com RLS
- Zustand store: `useMeetingStore` para estado client-side
- TanStack Query 5.96.2 apenas em Client Components
- Response format: `{ "data": {...}, "meta": { "page", "perPage", "total", "totalPages" } }`

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
- Epic 1 (Fundação): monorepo, Docker, Keycloak, observabilidade
- Epic 2 (Auth): autenticação, guards, RLS base
- Epic 4 (Grupos): CRUD de grupos e membros (group_id FK)

### Project Structure Notes
```
apps/api/src/modules/meetings/
  ├── meetings.module.ts
  ├── meetings.controller.ts
  ├── meetings.service.ts
  ├── meetings.repository.ts
  └── dto/
      ├── create-meeting.dto.ts
      └── update-meeting.dto.ts
apps/web/src/components/meetings/
  └── meeting-card.tsx
apps/web/src/app/(authenticated)/meetings/
  └── page.tsx
packages/types/src/meetings/
  ├── meeting.schema.ts
  └── meeting-status.enum.ts
apps/api/test/rls/
  └── meetings.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-05.md` — Story 5.1
- `docs/project-context.md` — Regras 1-47
- `docs/architecture.md` — Bounded context Meetings
- UX-DR13: MeetingCard design reference
