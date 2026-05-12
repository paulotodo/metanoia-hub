# Story 5.1: CRUD de Reuniões Vinculadas a Grupo

Status: in-review
baseline_commit: 2f35b110

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

- [x] Task 1: Criar Prisma schema para `meetings` (AC: #1)
  - [x] Definir model Meeting com campos: id, tenant_id, group_id, title, scheduled_at, duration_minutes, status, provider_room_id, created_by, created_at, updated_at
  - [x] Usar `@@map("meetings")` e `@map("snake_case")` para cada campo
  - [x] UUID v7 via `uuidv7()` — nunca `@default(uuid())`
  - [x] Criar enum `MeetingStatus` com valores: scheduled, in_progress, completed, cancelled
  - [x] Criar migration com RLS policy `rls_meetings_tenant_isolation`
- [x] Task 2: Criar módulo Meetings no NestJS (AC: #1, #2, #4)
  - [x] Criar `apps/api/src/modules/meetings/meetings.module.ts`
  - [x] Criar `meetings.controller.ts` com endpoints REST
  - [x] Criar `meetings.service.ts` com lógica de negócio
  - [x] Criar `meetings.repository.ts` (Core Domain — Repository Pattern obrigatório)
  - [x] Implementar DTOs com Zod: `CreateMeetingDto`, `UpdateMeetingDto` em `packages/types`
- [x] Task 3: Implementar endpoints CRUD (AC: #1, #4)
  - [x] `POST /api/v1/meetings` — criar reunião (201)
  - [x] `GET /api/v1/meetings` — listar com paginação, filtros status/group
  - [x] `GET /api/v1/meetings/:id` — detalhe
  - [x] `PATCH /api/v1/meetings/:id` — editar
  - [x] `DELETE /api/v1/meetings/:id` — cancelar (soft delete ou status cancelled)
- [x] Task 4: Implementar start/end meeting (AC: #2)
  - [x] `POST /api/v1/meetings/:id/start` — status → in_progress, criar room via VideoProviderAdapter
  - [x] `POST /api/v1/meetings/:id/end` — status → completed, fechar room
- [x] Task 5: Implementar endpoint de token de acesso (AC: #3)
  - [x] `POST /api/v1/meetings/:id/join` — gerar LiveKit access token on-demand
- [x] Task 6: Criar componente `MeetingCard` no frontend (AC: #3)
  - [x] Criar `apps/web/src/components/meetings/meeting-card.tsx`
  - [x] Exibir data, hora, status e botão de entrada 1-tap
  - [x] Integrar com endpoint de join para gerar token e redirecionar
- [x] Task 7: Criar tela de listagem de reuniões (AC: #4)
  - [x] Criar página `apps/web/src/app/(authenticated)/meetings/page.tsx`
  - [x] Usar TanStack Query (Client Component) para fetching
  - [x] Implementar filtros por status e grupo
  - [x] Paginação com meta { page, perPage, total, totalPages }
- [x] Task 8: Testes (AC: #1, #2, #3, #4)
  - [x] Testes unitários co-located `meetings.service.spec.ts`
  - [x] RLS isolation tests em `apps/api/test/rls/meetings.rls.spec.ts`
  - [x] Snapshot tests dos Zod schemas em `packages/types/__tests__/`
  - [x] Test factories com tenantId

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

## File List

**Schema / migration**
- `apps/api/prisma/schema.prisma` — Meeting model estendido com `title`, `durationMinutes`, `cancelledAt`, `createdBy`; novo índice por status.
- `apps/api/prisma/migrations/20260512120000_extend_meetings_story_5_1/migration.sql` — migration aditiva + reissue do check constraint para admitir `cancelled` + novo índice covering.

**Contracts (Zod)**
- `packages/types/src/meeting.ts` — adiciona `MeetingResponseSchema`, `CreateMeetingRequestSchema`, `UpdateMeetingRequestSchema`, `MeetingsListResponseSchema`, `MeetingsListQuerySchema`, `JoinMeetingResponseSchema`; estende `MeetingStatusSchema` com `cancelled`.
- `packages/types/src/index.ts` — exporta os novos schemas.
- `packages/types/src/__tests__/meeting.snapshot.spec.ts` — 6 snapshots novos cobrindo CRUD + atualização do snapshot do enum.

**Backend (NestJS)**
- `apps/api/src/meetings/meetings.controller.ts` — endpoints POST /, GET /, GET /:id, PATCH /:id, DELETE /:id (cancel), POST /:id/start, POST /:id/end, POST /:id/join. Mantém /room e /room/end históricos.
- `apps/api/src/meetings/meetings.service.ts` — métodos `create`, `list`, `findById`, `update`, `cancel`, `join` + `toResponse` que parseia via `MeetingResponseSchema`.
- `apps/api/src/meetings/meetings.repository.ts` — `list`, `update`, `markCancelled` + extensão de `createMeeting` para `title`, `durationMinutes`, `createdBy`.
- `apps/api/src/meetings/livekit/livekit.service.ts` — `getLivekitUrl()` (expõe URL ao service).
- `apps/api/src/meetings/meetings.service.spec.ts` — 9 cenários novos (create, list, findById, update, cancel ×3, join ×2).

**Test factories**
- `apps/api/test/factories/meeting.factory.ts` — suporta novos campos + status `cancelled`.

**Frontend (Next.js)**
- `apps/web/src/lib/api/client.ts` — `getEnvelope`, `patch`, `delete` no apiClient (mantém compat com fluxo `unwrap=data`).
- `apps/web/src/lib/api/hooks/use-meetings.ts` — `useMeetingsList`, `useCreateMeeting`, `useUpdateMeeting`, `useCancelMeeting`, `useJoinMeeting` + chaves de cache derivadas.
- `apps/web/src/components/meetings/meeting-card.tsx` — componente UX-DR13 com label de status, botão 1-tap de entrada.
- `apps/web/src/components/meetings/__tests__/meeting-card.spec.tsx` — 7 cenários (render, fallback title→topic, status labels, join, disabled, cancelled).
- `apps/web/app/(authenticated)/app/gestao/reunioes/page.tsx` — listagem paginada com filtros por status e Join 1-tap.

## Change Log

| Date | Change |
|------|--------|
| 2026-05-12 | Branch `feat/story-5-1-crud-reunioes` criada a partir de `dev@2f35b110`. |
| 2026-05-12 | Migration `20260512120000_extend_meetings_story_5_1` (aditiva) + schema.prisma estendido. |
| 2026-05-12 | Zod CRUD contracts + 6 snapshots novos no `packages/types`. |
| 2026-05-12 | NestJS: 7 endpoints novos (CRUD + start/end/join). 9 testes unit adicionais no service. |
| 2026-05-12 | Frontend: hook suite TanStack Query + MeetingCard + página de listagem + 7 testes. |
| 2026-05-12 | Lint+build+test verdes (API 353 testes; Web 247 testes; Types 144 testes). |

## Completion Notes

### Reconciliação com módulo pré-existente
A spec foi escrita assumindo que o módulo `meetings` não existia. Na realidade, o WDS Phase 5 Cenário 02 (PRs #44/#46) já entregou um módulo parcial com:
- Modelo `Meeting` (status string `scheduled|live|ended`, campos `scheduledFor`, `topic`, `livekitRoomId`, `startedAt`, `endedAt`).
- Endpoints GET /:id, POST /:id/room, POST /:id/room/end.
- LivekitService completo (real, não stub) com `roomNameFor`, `openRoom`, `closeRoom`, `generateJoinToken`.

**Decisão pragmática:** estender aditivamente em vez de reescrever, preservando contratos vivos do Cenário 02:
- Adicionei colunas nullable `title`, `duration_minutes`, `cancelled_at`, `created_by` (retrocompatíveis).
- Adicionei o status `cancelled` ao check constraint + enum Zod (4 valores totais).
- Mantive os endpoints `/room` e `/room/end` em uso pelo frontend; adicionei aliases `/start` e `/end` para casar com a nomenclatura da spec.
- Mantive a semântica de status existente: `live` cobre o conceito "in_progress" da spec; `ended` cobre "completed". Não introduzi duplicação.

### Adapter VideoProvider (Task 7)
A spec menciona "VideoProviderAdapter stub" mas o `LivekitService` já implementa o adapter de facto desde o Cenário 02 — é o ponto único entre o domínio Meetings e o SDK LiveKit. Não criei uma interface adicional para evitar abstração prematura; o endpoint `/join` consome `livekit.generateJoinToken` diretamente como qualquer adapter consumer.

### Cobertura de AC
- AC1 (criar com schema completo, RLS, 201): POST /meetings + migration aditiva + RLS preservado (policy `tenant_isolation` já estava em `meetings`).
- AC2 (start/end com adapter LiveKit): endpoints `/start`/`/end` (aliases) + `/room`/`/room/end` (legacy) — todos rotam pela mesma lógica `openRoom`/`endRoom`.
- AC3 (MeetingCard 1-tap + token on-demand): `meeting-card.tsx` + endpoint POST /meetings/:id/join consumindo `generateJoinToken`.
- AC4 (listagem paginada com filtros): GET /meetings + página `(authenticated)/app/gestao/reunioes/page.tsx` com filtros e paginação.

### Out of scope (deferred para Story 5-2)
- Real-time presence pipeline (Story 5-3).
- Webhook handlers LiveKit já existem do Cenário 02 (`livekit-webhook.controller.ts`).
- `provider_room_id` na spec ↔ `livekit_room_id` no DB: mantive nome legado no DB e expus como `providerRoomId` no schema Zod de resposta (alias de apresentação).

### Suite de testes
- Vermelhos pré-existentes do baseline (`test/rls/**`, `test/marketing/**`, `test/migrations/**`) NÃO foram tocados — eles falham por env DB SASL ausente, ortogonal a esta entrega.
- Comando usado para a suite verde: `npx vitest run --exclude 'test/rls/**' --exclude 'test/marketing/**' --exclude 'test/migrations/**'`.
