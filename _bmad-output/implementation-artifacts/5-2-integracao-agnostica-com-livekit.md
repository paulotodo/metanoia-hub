# Story 5.2: Integração Agnóstica com LiveKit

Status: ready-for-dev

## Story

As a platform operator,
I want a provider-agnostic video integration via adapter pattern with LiveKit as MVP implementation,
so that the video provider can be swapped in the future without code changes.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Definir interface VideoProviderAdapter (AC: #1)
  - [ ] Criar `apps/api/src/modules/meetings/adapters/video-provider.adapter.ts`
  - [ ] Definir interface com métodos: createRoom, deleteRoom, generateToken, getActiveParticipants, handleWebhook
  - [ ] Definir tipos de retorno tipados para cada método
  - [ ] Exportar tipos em `packages/types/src/meetings/video-provider.types.ts`
- [ ] Task 2: Implementar LiveKitAdapter (AC: #1, #2)
  - [ ] Criar `apps/api/src/modules/meetings/adapters/livekit.adapter.ts`
  - [ ] Instalar `livekit-server-sdk` como dependência
  - [ ] Implementar createRoom com opções (maxParticipants, emptyTimeout)
  - [ ] Implementar deleteRoom
  - [ ] Implementar generateToken com room, identity (userId), metadata (tenantId)
  - [ ] Implementar getActiveParticipants
  - [ ] Implementar handleWebhook com validação de assinatura
- [ ] Task 3: Configurar injeção de dependência (AC: #1)
  - [ ] Registrar LiveKitAdapter como provider do token VIDEO_PROVIDER_ADAPTER no NestJS module
  - [ ] Configurar variáveis de ambiente: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
- [ ] Task 4: Implementar webhook endpoint (AC: #3)
  - [ ] Criar `POST /api/v1/webhooks/livekit` endpoint
  - [ ] Validar assinatura contra LiveKit API key — rejeitar com 401 se inválido
  - [ ] Parsear payload em domain events tipados
  - [ ] Retornar 200 após processamento
- [ ] Task 5: Implementar isolamento Redis multi-tenant (AC: #4)
  - [ ] Usar namespace `rt:meeting:{tenantId}:{meetingId}` para estado em cache
  - [ ] Garantir que webhooks de tenant A não alimentam cache de tenant B
- [ ] Task 6: Configurar BullMQ para processamento de meetings (AC: #4)
  - [ ] Criar queue `queue:meetings` para processamento assíncrono
  - [ ] Configurar worker com concurrency adequada
- [ ] Task 7: Testes (AC: #1, #2, #3, #4)
  - [ ] Testes unitários `livekit.adapter.spec.ts`
  - [ ] Teste de validação de webhook signature
  - [ ] Integration test: dois meetings em tenants diferentes — isolamento Redis
  - [ ] Performance test: entry time < 3s (NFR-P1)
  - [ ] Snapshot tests dos tipos Zod em `packages/types/__tests__/`

## Dev Notes

- **Adapter Pattern**: interface abstrata + implementação concreta LiveKit. Permite trocar provider sem alterar código de negócio
- `livekit-server-sdk` para interação com LiveKit server
- Redis namespaces: `rt:meeting:{tenantId}:{meetingId}` para estado real-time
- BullMQ para escalabilidade independente de processamento (NFR-E2)
- Token deve incluir metadata com tenantId para isolamento multi-tenant
- Webhook endpoint é público (sem auth guard) mas valida assinatura LiveKit

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
- Story 5.1: CRUD de Reuniões (schema, module base)
- Epic 1, Story 1.6: Spike Pipeline Real-time (LiveKit → Redis → BullMQ → SSE)
- Epic 1, Story 1.2: Docker Compose com LiveKit

### Project Structure Notes
```
apps/api/src/modules/meetings/
  ├── adapters/
  │   ├── video-provider.adapter.ts    (interface)
  │   └── livekit.adapter.ts           (implementação)
  ├── webhooks/
  │   └── livekit-webhook.controller.ts
  └── queues/
      └── meeting.processor.ts
packages/types/src/meetings/
  └── video-provider.types.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-05.md` — Story 5.2
- `docs/architecture.md` — Adapter pattern, LiveKit integration
- `docs/project-context.md` — Redis namespaces (cache:*, rt:*, queue:*)
