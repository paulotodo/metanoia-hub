# Story 14.2a: SSE Endpoint & Redis Pub/Sub Backend (FR77)

Status: ready-for-dev

## Story

As a developer,
I want an SSE endpoint that pushes real-time notifications to connected clients,
So that users receive instant updates without polling.

## Acceptance Criteria

**Given** an authenticated user opens the application
**When** the frontend establishes an SSE connection to `GET /api/v1/sse/notifications`
**Then** the connection is tenant-scoped (guard validates Keycloak token, extracts `tenant_id` and `user_id`)
**And** the server sends a heartbeat comment (`: heartbeat`) every 30 seconds to keep the connection alive and detect dead connections
**And** the server enforces a maximum of 1000 concurrent SSE connections per NestJS instance (configurable via `SSE_MAX_CONNECTIONS`)
**And** if instance limit is reached, new connections receive 503 with `Retry-After: 30` header

**Given** a user already has SSE connections open in multiple tabs
**When** they open a 6th tab
**Then** the server tracks connections per user via Redis (`sse:connections:{tenantId}:{userId}` — SET of connection IDs)
**And** the maximum is 5 connections per user (configurable via `SSE_MAX_PER_USER`)
**And** when exceeded, the oldest connection is gracefully closed with an SSE event `event: close\ndata: { reason: 'max_connections_exceeded' }\n\n` before the new one is accepted

**Given** the `InAppChannel` processor sends a notification
**When** it processes the BullMQ job
**Then** the notification is saved to the `Notification` table with `status: 'sent'`
**And** an event is published to Redis Pub/Sub channel `rt:notifications:{tenantId}:{userId}` (tenant-scoped to prevent cross-tenant leakage)
**And** the SSE controller subscribes to the Redis channel and pushes to the client: `event: notification\ndata: { id, type, title, body, createdAt }\n\n`

**Given** the SSE connection is closed (user navigates away, tab closes)
**When** the server detects disconnection (via heartbeat timeout or explicit close)
**Then** the connection ID is removed from the Redis SET `sse:connections:{tenantId}:{userId}`
**And** the Redis Pub/Sub subscription for that connection is cleaned up

## Tasks / Subtasks

- [ ] Task 1: Implement SSE controller `GET /api/v1/sse/notifications` (AC: #1)
  - [ ] Create `SseController` in `apps/api/src/modules/notifications/sse/`
  - [ ] Validate Keycloak token, extract `tenant_id` and `user_id`
  - [ ] Implement heartbeat comment (`: heartbeat`) every 30 seconds
  - [ ] Enforce max 1000 concurrent connections per instance (configurable via `SSE_MAX_CONNECTIONS` env var)
  - [ ] Return 503 with `Retry-After: 30` header when limit reached
- [ ] Task 2: Implement per-user connection tracking via Redis (AC: #2)
  - [ ] Track connections in Redis SET `sse:connections:{tenantId}:{userId}`
  - [ ] Enforce max 5 connections per user (configurable via `SSE_MAX_PER_USER`)
  - [ ] Gracefully close oldest connection with `event: close` and reason `max_connections_exceeded`
- [ ] Task 3: Implement Redis Pub/Sub integration (AC: #3)
  - [ ] Publish notification events to `rt:notifications:{tenantId}:{userId}` channel
  - [ ] Subscribe SSE controller to Redis channel for connected users
  - [ ] Push SSE event: `event: notification\ndata: { id, type, title, body, createdAt }\n\n`
  - [ ] Ensure tenant-scoped channels prevent cross-tenant leakage
- [ ] Task 4: Implement connection cleanup (AC: #4)
  - [ ] Detect disconnection via heartbeat timeout or explicit close
  - [ ] Remove connection ID from Redis SET
  - [ ] Clean up Redis Pub/Sub subscription
- [ ] Task 5: Write tests (AC: all)
  - [ ] Integration test: dispatch notification → verify SSE event received via Redis Pub/Sub
  - [ ] Cross-tenant isolation test: user1 in tenant A and user1 in tenant B both connected → notification for tenant A → ONLY tenant A connection receives
  - [ ] Per-user limit test: 6 connections → verify oldest closed
  - [ ] Load test: 500 concurrent SSE connections — memory heap < 512MB, event loop lag p99 < 100ms, zero dropped connections during 5min
  - [ ] Heartbeat test: verify `: heartbeat` every 30s

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Redis Namespaces
- `rt:notifications:{tenantId}:{userId}` — Pub/Sub channel for real-time notifications
- `sse:connections:{tenantId}:{userId}` — SET of connection IDs for per-user tracking

### Dependencies
- Story 14.1 (notification infrastructure — InAppChannel processor publishes to Redis)

### Project Structure Notes
- Backend: `apps/api/src/modules/notifications/sse/`
  - `sse.controller.ts` — SSE endpoint
  - `sse-connection.manager.ts` — connection tracking and limits
  - `sse-redis.service.ts` — Redis Pub/Sub integration
- Config: `SSE_MAX_CONNECTIONS` (default: 1000), `SSE_MAX_PER_USER` (default: 5)

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-14.md` (Story 14.2a)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
