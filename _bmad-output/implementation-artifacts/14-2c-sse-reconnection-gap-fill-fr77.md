# Story 14.2c: SSE Reconnection & Gap Fill (FR77)

Status: ready-for-dev

## Story

As a user,
I want SSE connections to automatically reconnect and recover missed notifications,
So that I don't miss important updates due to network issues.

## Acceptance Criteria

**Given** the SSE connection is lost (network issue, server restart)
**When** the EventSource in the browser detects disconnection
**Then** it reconnects automatically with exponential backoff: 1s, 2s, 4s, 8s, max 30s
**And** a subtle indicator appears in the UI: "Reconectando..." (disappears on successful reconnect)

**Given** the SSE connection is re-established
**When** the client reconnects
**Then** it fetches missed notifications via `GET /api/v1/notifications?since={lastReceivedAt}&status=unread` to fill the gap
**And** the `lastReceivedAt` is tracked in memory (not persisted — page refresh fetches all unread)
**And** missed notifications are merged into the notification center without duplicates (deduplicate by `id`)

**Given** reconnection fails repeatedly (server down for extended period)
**When** backoff reaches max (30s) and 5 consecutive attempts fail
**Then** the reconnection continues in background but the UI shows: "Sem conexão. Notificações podem estar atrasadas." with a "Tentar agora" manual retry button

## Tasks / Subtasks

- [ ] Task 1: Implement SSE reconnection with exponential backoff (AC: #1)
  - [ ] Create `SseClient` service in `apps/web/` wrapping EventSource
  - [ ] Implement reconnection with backoff: 1s, 2s, 4s, 8s, max 30s
  - [ ] Track reconnection attempts count
- [ ] Task 2: Build reconnection UI indicator (AC: #1, #3)
  - [ ] Show "Reconectando..." subtle indicator during reconnection attempts
  - [ ] After 5 consecutive failures: show "Sem conexão. Notificações podem estar atrasadas."
  - [ ] Add "Tentar agora" manual retry button
  - [ ] Disappear indicators on successful reconnect
- [ ] Task 3: Implement gap fill on reconnection (AC: #2)
  - [ ] Track `lastReceivedAt` timestamp in memory
  - [ ] On reconnect: fetch `GET /api/v1/notifications?since={lastReceivedAt}&status=unread`
  - [ ] Merge missed notifications into notification center, deduplicate by `id`
  - [ ] On page refresh: fetch all unread (no lastReceivedAt tracking)
- [ ] Task 4: Add `since` filter support to notifications API (AC: #2)
  - [ ] Extend `GET /api/v1/notifications` to accept `since` query parameter (ISO 8601 timestamp)
  - [ ] Filter notifications created after `since` timestamp
- [ ] Task 5: Write tests (AC: all)
  - [ ] E2E Playwright: simulate disconnect (kill SSE endpoint) → verify auto-reconnect → verify gap fill fetches missed notifications
  - [ ] Extended outage test: 5 failed reconnects → verify UI warning
  - [ ] Reconnect success test: verify indicator disappears and missed notifications appear

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Story 14.2a (SSE endpoint — the connection being reconnected)
- Story 14.2b (Notification Center UI — where missed notifications are merged)

### Project Structure Notes
- Frontend: `apps/web/lib/sse-client.ts` — SSE connection wrapper with reconnection
- Frontend: `apps/web/components/notifications/connection-status.tsx` — reconnection indicator
- API: extend `apps/api/src/modules/notifications/notification.controller.ts` with `since` filter

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-14.md` (Story 14.2c)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
