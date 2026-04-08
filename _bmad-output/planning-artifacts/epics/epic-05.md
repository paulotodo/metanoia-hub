## Epic 5: Reuniões ao Vivo & Presença MVP

Líder cria e gerencia reuniões vinculadas a grupos. Integração com LiveKit (adapter pattern para troca futura). Presença automática, telemetria básica, banner de transparência, lista de presença em tempo real, estado em cache.

### Story 5.1: CRUD de Reuniões Vinculadas a Grupo

As a Admin/Líder,
I want to create, edit, cancel and manage meetings linked to a group,
So that I can schedule and control discipleship meetings.

**Acceptance Criteria:**

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

### Story 5.2: Integração Agnóstica com LiveKit

As a platform operator,
I want a provider-agnostic video integration via adapter pattern with LiveKit as MVP implementation,
So that the video provider can be swapped in the future without code changes.

**Acceptance Criteria:**

**Given** the system needs to integrate with a video provider
**When** the adapter is implemented
**Then** the interface `VideoProviderAdapter` exposes methods: `createRoom(options)`, `deleteRoom(roomId)`, `generateToken(roomId, identity, metadata)`, `getActiveParticipants(roomId)`, `handleWebhook(headers, body)` (parses and validates provider-specific webhooks, returns typed events)
**And** `LiveKitAdapter` implements this interface as the MVP provider

**Given** a participant enters a meeting
**When** a token is generated
**Then** the token includes `room` (provider_room_id), `identity` (userId), and `metadata` (tenantId) — ensuring multi-tenant isolation
**And** entry time is < 3s (NFR-P1)

**Given** LiveKit sends a webhook
**When** the endpoint receives it
**Then** the webhook signature is validated against the LiveKit API key before processing (reject unsigned/invalid webhooks with 401)
**And** the `handleWebhook` method on the adapter parses the raw payload into typed domain events

**Given** two simultaneous meetings in different tenants
**When** integration tests run
**Then** webhooks from tenant A do not feed cache of tenant B (Redis namespace isolation: `rt:meeting:{tenantId}:{meetingId}`)
**And** meeting processing scales independently via BullMQ (NFR-E2)

### Story 5.3: Pipeline de Presença Automática

As a platform operator,
I want automatic presence tracking with reconnection tolerance and cached meeting state,
So that attendance is recorded accurately without manual intervention.

**Acceptance Criteria:**

**Given** a meeting is in progress
**When** LiveKit webhooks are received (`participant_joined`, `participant_left`, `track_published`, `track_unpublished`)
**Then** events flow through the pipeline: webhook endpoint → adapter validates signature → Redis state update (`rt:meeting:{tenantId}:{meetingId}`) → BullMQ job → PostgreSQL persistence
**And** webhook processing is idempotent: dedup via Redis `SETNX` with key `webhook:{eventId}` and TTL 1h — duplicate events are silently skipped

**Given** a meeting is active
**When** presence state is maintained in Redis
**Then** a checkpoint job (BullMQ repeatable, every 5 minutes) flushes partial state to PostgreSQL `meeting_snapshots` for crash recovery
**And** on meeting end, final flush persists complete data to `meeting_attendance`

**Given** presence is tracked
**When** a participant's total duration is calculated
**Then** presence is classified as `integral` (≥ 80% of meeting duration) or `parcial` (< 80%) — threshold hardcoded as constant (configurável por tenant deferred to Epic 11)
**And** the `meeting_attendance` table includes: `id` (UUID v7), `tenant_id`, `meeting_id`, `user_id`, `join_time`, `leave_time`, `total_duration_seconds`, `presence_type` (enum: `integral`, `parcial`, `ausente`), `reconnections` (int), `created_at`

**Given** a participant disconnects during a meeting
**When** they reconnect within the tolerance window (default: 2 min, configurable)
**Then** the disconnection does not penalize their presence record (FR48)
**And** the `reconnections` counter is incremented

**Given** presence data exists
**When** RLS tests run
**Then** tests verify isolation with JOINs across meeting↔group↔participant relationships cross-tenant

### Story 5.4: Telemetria Básica de Engajamento

As a Líder,
I want basic engagement telemetry (camera time, room duration, focus indicator),
So that I have visibility into participation quality beyond just attendance.

**Acceptance Criteria:**

**Given** a meeting is in progress and telemetry is being collected
**When** track events are processed
**Then** `camera_on_seconds` is calculated from `track_published`/`track_unpublished` events (video track only)
**And** `room_duration_seconds` is total time in room (join→leave, excluding disconnections outside tolerance window)

**Given** the focus indicator feature toggle is enabled for the tenant
**When** a participant is in a meeting
**Then** the frontend sends a heartbeat every 30s with `{ visible: boolean }` (via Page Visibility API) through WebSocket
**And** `focus_score` is calculated as `visible_seconds / total_seconds` (range 0.0–1.0)
**And** focus data is only collected AFTER the transparency banner has been displayed (privacy guarantee)

**Given** the focus indicator feature toggle is disabled (default for new tenants, NFR-L4)
**When** telemetry is processed
**Then** `focus_score` is stored as `null` and no focus heartbeats are sent from the frontend

**Given** telemetry data is collected
**When** it is persisted
**Then** it is stored in `meeting_telemetry`: `id` (UUID v7), `tenant_id`, `meeting_id`, `user_id`, `camera_on_seconds`, `room_duration_seconds`, `focus_score` (nullable, 0.0–1.0), `created_at`
**And** processing is asynchronous via BullMQ (does not block meeting flow)

### Story 5.5: Banner de Transparência & Lista de Presença Real-Time

As a Participante/Líder,
I want to see a transparency banner during meetings and the leader to see live attendance,
So that participants know what is being tracked and leaders have real-time visibility.

**Acceptance Criteria:**

**Given** a participant joins a meeting
**When** the meeting view loads
**Then** a persistent banner is displayed: "Sinais de presença e engajamento estão sendo registrados para acompanhamento pastoral" (PT-BR, pastoral vocabulary)
**And** if focus indicator toggle is ON for the tenant, the banner additionally states: "O indicador de foco de aba também está ativo"

**Given** I am Líder or Admin of the meeting's group
**When** I view the live attendance panel during a meeting
**Then** I see real-time list via SSE with: participant name, status (na sala/saiu), current duration, camera on/off
**And** updates arrive within ≤ 1s (NFR-P4)
**And** data is served from Redis cache (`rt:meeting:{tenantId}:{meetingId}`)

**Given** the SSE connection drops
**When** the client detects disconnection
**Then** automatic reconnection is triggered and the server sends full current state (not just deltas) upon reconnect

**Given** I am a Participante (not Líder/Admin)
**When** I try to access the live attendance panel
**Then** I do not have access — only Líder and Admin of the group can view the real-time presence list

### Story 5.6: Relatório Pós-Reunião & Notificações

As a Líder,
I want an automatic post-meeting report and participants to receive meeting notifications,
So that I have a summary of each meeting and participants are reminded of upcoming meetings.

**Acceptance Criteria:**

**Given** a meeting is ended (status → `completed`)
**When** the post-meeting BullMQ job processes
**Then** an automatic report is generated and stored in `meeting_reports`: `id` (UUID v7), `tenant_id`, `meeting_id`, `summary` (JSONB), `generated_at`
**And** the JSONB `summary` follows the schema: `{ attendees: [{ userId, name, presenceType, durationSeconds, cameraSeconds, focusScore }], totalDurationMinutes, avgEngagementScore, totalPresent, totalPartial, totalAbsent }`

**Given** I am Líder or Admin
**When** I access the meeting detail after completion
**Then** I see the full post-meeting report with all attendee details and aggregated metrics

**Given** I am a Participante
**When** I access a completed meeting
**Then** I see only my own presence status and duration (not the full report) — full report is restricted to Líder/Admin in MVP

**Given** a meeting is scheduled
**When** the notification time approaches (default: 30 min before, configurable)
**Then** a notification is enqueued via BullMQ (stub implementation — log + queue, real provider integration in Epic 12, same approach as Story 4.3)

