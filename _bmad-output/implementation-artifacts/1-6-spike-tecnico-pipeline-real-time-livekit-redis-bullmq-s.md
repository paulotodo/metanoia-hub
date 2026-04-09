# Story 1.6: Spike Técnico — Pipeline Real-time (LiveKit → Redis → BullMQ → SSE)

Status: ready-for-dev

## Story

As a developer,
I want a validated proof-of-concept of the real-time pipeline using authenticated requests and structured logging,
So that I have confidence the architecture works before building meeting features.

## Acceptance Criteria

**Given** Keycloak spike (Story 1.4) is validated and a valid JWT token is available
**And** RequestContext middleware (Story 1.5) is injecting tenant_id/user_id into AsyncLocalStorage
**When** a simulated LiveKit webhook event `room.participant_joined` is sent to the NestJS endpoint
**Then** the RequestContext middleware extracts `tenant_id` and `user_id` from the JWT
**And** the event is stored in Redis under namespace `rt:meeting:{tenantId}:{meetingId}:presence`
**And** a BullMQ job is enqueued in `queue:meetings`
**And** the BullMQ worker processes the job and flushes the event from Redis to PostgreSQL
**And** an SSE endpoint `GET /api/v1/sse/meetings/:id` pushes the event to connected clients (authenticated via JWT)
**And** a minimal React component receives and displays the SSE event in real-time
**And** all pipeline steps produce structured Pino logs with tenant_id and meeting_id
**And** the full pipeline completes in under 2 seconds end-to-end
**And** events from Tenant A are NOT visible to SSE subscribers of Tenant B (namespace isolation validated with 2 concurrent tenants)
**And** **time-box:** this spike must be completed in 3 days maximum

## Tasks / Subtasks

- [ ] Task 1: Criar endpoint para webhook LiveKit (AC: #1, #2, #3)
  - [ ] 1.1 Criar `apps/api/src/meetings/webhooks/livekit-webhook.controller.ts`
  - [ ] 1.2 Implementar handler para `room.participant_joined`
  - [ ] 1.3 Extrair tenant_id e user_id do JWT via RequestContext

- [ ] Task 2: Armazenar evento no Redis (AC: #3)
  - [ ] 2.1 Armazenar presença em `rt:meeting:{tenantId}:{meetingId}:presence`
  - [ ] 2.2 Seguir namespaces Redis: `rt:*` para real-time

- [ ] Task 3: Enfileirar job no BullMQ (AC: #4)
  - [ ] 3.1 Configurar queue `queue:meetings` no BullMQ
  - [ ] 3.2 Enfileirar job com dados do evento

- [ ] Task 4: Worker BullMQ para flush no PostgreSQL (AC: #5)
  - [ ] 4.1 Criar worker que processa jobs da queue `queue:meetings`
  - [ ] 4.2 Persistir evento no PostgreSQL

- [ ] Task 5: Endpoint SSE autenticado (AC: #6)
  - [ ] 5.1 Criar `GET /api/v1/sse/meetings/:id` com autenticação JWT
  - [ ] 5.2 Implementar push de eventos via SSE
  - [ ] 5.3 Validar que SSE respeita tenant isolation

- [ ] Task 6: Componente React minimal (AC: #7)
  - [ ] 6.1 Criar componente em `apps/web` que conecta ao SSE endpoint
  - [ ] 6.2 Exibir eventos em real-time

- [ ] Task 7: Logging e performance (AC: #8, #9)
  - [ ] 7.1 Adicionar Pino logs estruturados em cada step do pipeline
  - [ ] 7.2 Medir e validar que pipeline completa em < 2 segundos

- [ ] Task 8: Teste de isolamento multi-tenant (AC: #10)
  - [ ] 8.1 Criar teste com 2 tenants concorrentes
  - [ ] 8.2 Validar que Tenant A não vê eventos do Tenant B via SSE

## Dev Notes

### Stack & Versões
- LiveKit Server SDK
- BullMQ (latest) com Redis
- Redis 7 namespaces: `rt:*` (real-time), `queue:*` (BullMQ)
- SSE (Server-Sent Events) nativo do NestJS
- Pino structured logging

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.1 (Scaffold do Monorepo) — NestJS + Redis base
- Story 1.2 (Docker Compose Completo) — LiveKit service
- Story 1.4 (Spike Keycloak) — JWT token válido
- Story 1.5 (Observabilidade) — RequestContext + Pino logging

### Project Structure Notes
```
apps/api/src/meetings/
├── webhooks/
│   └── livekit-webhook.controller.ts
├── queues/
│   ├── meetings.producer.ts
│   └── meetings.worker.ts
└── sse/
    └── meetings-sse.controller.ts

apps/web/app/spike/
└── sse-test/page.tsx               # Minimal React component for SSE
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-01.md — Story 1.6]
- [Source: docs/project-context.md — Redis namespaces, BullMQ patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md — Real-time pipeline]
