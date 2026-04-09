# Story 14.2b: Notification Center UI (FR77)

Status: ready-for-dev

## Story

As a user,
I want a notification center in the header to view and manage my notifications,
So that I can quickly see what needs my attention and take action.

## Acceptance Criteria

**Given** a user is logged in
**When** they see the header
**Then** a bell icon is displayed with a badge showing unread count (capped at "99+")
**And** the badge has `aria-label="{count} notificações não lidas"` (or `"99 ou mais notificações não lidas"` when capped)
**And** when a new notification arrives via SSE, `aria-live="polite"` announces: "Nova notificação: {title}"

**Given** the user clicks the bell icon
**When** the notification dropdown opens
**Then** `GET /api/v1/notifications?status=unread&limit=20` returns the latest unread notifications
**And** each notification shows: icon by type, title, body preview (truncated at 100 chars), relative time ("há 5 min")
**And** clicking a notification marks it as read (`PATCH /api/v1/notifications/:id` with `{ status: 'read' }`) and navigates to `metadata.actionUrl`

**Given** the user has zero notifications
**When** they open the notification center
**Then** an empty state is displayed with illustration and message: "Tudo tranquilo por aqui! Suas notificações aparecerão aqui." (vocabulário pastoral, texto via i18n `pt-BR.json`)

**Given** a user wants to manage notifications
**When** they interact with the notification center
**Then** "Marcar todas como lidas" button marks all unread as read in batch (`PATCH /api/v1/notifications/mark-all-read`)
**And** a "Silenciar notificações" toggle is available — when enabled, SSE events are still received but no visual/audio alert is triggered
**And** the toggle is stored in `localStorage` (nota: local ao dispositivo; sincronização cross-device virá com FR78/Post-MVP)

## Tasks / Subtasks

- [ ] Task 1: Implement notification API endpoints (AC: #2, #4)
  - [ ] `GET /api/v1/notifications?status=unread&limit=20` — list unread notifications
  - [ ] `PATCH /api/v1/notifications/:id` with `{ status: 'read' }` — mark as read
  - [ ] `PATCH /api/v1/notifications/mark-all-read` — batch mark all as read
  - [ ] All endpoints enforce tenant_id via RLS
- [ ] Task 2: Create Zod schemas in `packages/types` (AC: #2)
  - [ ] Define `NotificationListQuerySchema` (status filter, limit)
  - [ ] Define `NotificationUpdateSchema`
  - [ ] Add snapshot tests
- [ ] Task 3: Build bell icon with badge in header (AC: #1)
  - [ ] Create `NotificationBell` component in `packages/ui/` or `apps/web/`
  - [ ] Display unread count badge (capped at "99+")
  - [ ] Add `aria-label="{count} notificações não lidas"` (or "99 ou mais..." when capped)
  - [ ] Add `aria-live="polite"` region for new notification announcements
- [ ] Task 4: Build notification dropdown (AC: #2, #3)
  - [ ] Create `NotificationCenter` dropdown component
  - [ ] List notifications with: type icon, title, body preview (truncated 100 chars), relative time
  - [ ] Click notification → mark as read → navigate to `metadata.actionUrl`
  - [ ] Empty state with illustration and pastoral message (text from `pt-BR.json`)
- [ ] Task 5: Implement notification management actions (AC: #4)
  - [ ] "Marcar todas como lidas" button with batch API call
  - [ ] "Silenciar notificações" toggle stored in localStorage
  - [ ] When silenced: SSE events received but no visual/audio alert
- [ ] Task 6: Integrate SSE events with notification center (AC: #1)
  - [ ] Listen to SSE `notification` events from Story 14.2a
  - [ ] Update badge count on new notification
  - [ ] Announce via `aria-live="polite"`: "Nova notificação: {title}"
  - [ ] Use TanStack Query for notification data, invalidate on SSE event
- [ ] Task 7: Write tests (AC: all)
  - [ ] E2E Playwright: bell icon → badge count → click → dropdown → notification list → click notification → mark as read → navigate to actionUrl
  - [ ] Empty state test: user with no notifications → verify empty state message
  - [ ] Silenciar toggle test: enable → verify no visual alert on new notification
  - [ ] Accessibility test: verify `aria-label` on badge, `aria-live` announcement

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### i18n
- All user-facing messages in PT-BR via `apps/web/messages/pt-BR.json`
- Use pastoral vocabulary (not corporate)

### Dependencies
- Story 14.1 (notification infrastructure — Notification table, dispatch service)
- Story 14.2a (SSE endpoint — real-time notification delivery)

### Project Structure Notes
- Frontend: `apps/web/components/notifications/notification-bell.tsx`
- Frontend: `apps/web/components/notifications/notification-center.tsx`
- i18n: `apps/web/messages/pt-BR.json` — notification-related messages
- API: `apps/api/src/modules/notifications/notification.controller.ts`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-14.md` (Story 14.2b)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
