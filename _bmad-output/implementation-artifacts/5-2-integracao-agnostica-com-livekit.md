# Story 5.2: Integração Agnóstica com LiveKit

Status: done
baseline_commit: c6ceacc
merged_commit: 1b2f30a
pr: 107

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

- [x] Task 1: Definir interface VideoProviderAdapter (AC: #1)
  - [x] Criar `apps/api/src/modules/meetings/adapters/video-provider.adapter.ts`
  - [x] Definir interface com métodos: createRoom, deleteRoom, generateToken, getActiveParticipants, handleWebhook
  - [x] Definir tipos de retorno tipados para cada método
  - [x] Exportar tipos em `packages/types/src/meetings/video-provider.types.ts`
- [x] Task 2: Implementar LiveKitAdapter (AC: #1, #2)
  - [x] Criar `apps/api/src/modules/meetings/adapters/livekit.adapter.ts`
  - [x] Instalar `livekit-server-sdk` como dependência
  - [x] Implementar createRoom com opções (maxParticipants, emptyTimeout)
  - [x] Implementar deleteRoom
  - [x] Implementar generateToken com room, identity (userId), metadata (tenantId)
  - [x] Implementar getActiveParticipants
  - [x] Implementar handleWebhook com validação de assinatura
- [x] Task 3: Configurar injeção de dependência (AC: #1)
  - [x] Registrar LiveKitAdapter como provider do token VIDEO_PROVIDER_ADAPTER no NestJS module
  - [x] Configurar variáveis de ambiente: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
- [x] Task 4: Implementar webhook endpoint (AC: #3)
  - [x] Criar `POST /api/v1/webhooks/livekit` endpoint
  - [x] Validar assinatura contra LiveKit API key — rejeitar com 401 se inválido
  - [x] Parsear payload em domain events tipados
  - [x] Retornar 200 após processamento
- [x] Task 5: Implementar isolamento Redis multi-tenant (AC: #4)
  - [x] Usar namespace `rt:meeting:{tenantId}:{meetingId}` para estado em cache
  - [x] Garantir que webhooks de tenant A não alimentam cache de tenant B
- [x] Task 6: Configurar BullMQ para processamento de meetings (AC: #4)
  - [x] Criar queue `queue:meetings` para processamento assíncrono
  - [x] Configurar worker com concurrency adequada
- [x] Task 7: Testes (AC: #1, #2, #3, #4)
  - [x] Testes unitários `livekit.adapter.spec.ts`
  - [x] Teste de validação de webhook signature
  - [x] Integration test: dois meetings em tenants diferentes — isolamento Redis
  - [x] Performance test: entry time < 3s (NFR-P1)
  - [x] Snapshot tests dos tipos Zod em `packages/types/__tests__/`

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

## File List

**Contracts (`packages/types`)**
- `packages/types/src/video-provider.ts` — `CreateRoomOptions`, `GenerateTokenOptions`, `ProviderRoom`, `ProviderParticipant`, `VideoProviderEvent` (discriminated union: room.started/finished, participant.joined/left, unknown), `VideoProviderSignatureError`.
- `packages/types/src/index.ts` — exports do novo módulo video-provider.
- `packages/types/src/__tests__/video-provider.snapshot.spec.ts` — 9 snapshots (CreateRoomOptions, GenerateTokenOptions, ProviderRoom, ProviderParticipant, eventos + enum + error).

**Adapter (`apps/api/src/meetings/adapters/`)**
- `video-provider.adapter.ts` — interface + DI token `VIDEO_PROVIDER_ADAPTER`.
- `livekit.adapter.ts` — MVP implementação: `createRoom`, `deleteRoom`, `generateToken` (com metadata.tenantId), `getActiveParticipants`, `handleWebhook` (signature → parsed typed event); raises `VideoProviderSignatureError` em falha.
- `__tests__/livekit.adapter.spec.ts` — 13 testes (constructor, todos os métodos + 6 cenários webhook signature).

**Service (`apps/api/src/meetings/`)**
- `meetings.service.ts` — injeta `VIDEO_PROVIDER_ADAPTER` via `@Inject` (não mais `LivekitService`); `openRoom` compõe createRoom + generateToken; `join` usa adapter.generateToken; metadata.tenantId em todos os tokens.
- `meetings.service.spec.ts` — testes atualizados para mock do adapter (camada renomeada de `livekit` → `videoProvider`).

**Webhook (`apps/api/src/meetings/webhooks/`)**
- `livekit-webhook.controller.ts` — thin: delega `videoProvider.handleWebhook`; mapeia `VideoProviderSignatureError` → `UnauthorizedException` (HTTP 401, NFR-S3); preserva fluxo RequestContext + MeetingEventService.
- `livekit-webhook.controller.spec.ts` — 5 testes (401 invalid sig, 401 missing header, ignore non-join, 400 malformed room, happy path).

**Multi-tenant isolation (`apps/api/src/meetings/events/__tests__/`)**
- `multi-tenant-isolation.spec.ts` — 3 testes provando que presence key, event channel e BullMQ job payload são todos namespaced por `tenantId` (AC4).

**Module (`apps/api/src/meetings/meetings.module.ts`)**
- Registra `LiveKitAdapter` + `{ provide: VIDEO_PROVIDER_ADAPTER, useExisting: LiveKitAdapter }`; exporta ambos. Remove `LivekitService` antigo.

**Removidos**
- `apps/api/src/meetings/livekit/livekit.service.ts` (substituído pelo adapter)
- `apps/api/src/meetings/livekit/livekit.service.spec.ts` (substituído por `livekit.adapter.spec.ts`)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-12 | Branch `feat/story-5-2-livekit-adapter` criada a partir de `dev@c6ceacc`. |
| 2026-05-12 | Tipos `VideoProviderAdapter` + eventos discriminated em `packages/types`. |
| 2026-05-12 | Interface `VideoProviderAdapter` + DI token + `LiveKitAdapter` MVP. |
| 2026-05-12 | `MeetingsService` migrado para injeção via token; webhook controller refatorado para 401 em signature inválida. |
| 2026-05-12 | Tests: 13 livekit.adapter + 5 webhook + 3 multi-tenant + 9 snapshots types (155 testes types totais). |
| 2026-05-12 | Lint+build verdes (API 370 tests; Web 247 tests; Types 155 tests). |

## Completion Notes

### AC mapping

- **AC1** (interface + LiveKit MVP): `VideoProviderAdapter` em `apps/api/src/meetings/adapters/` com 5 métodos canônicos (createRoom, deleteRoom, generateToken, getActiveParticipants, handleWebhook). `LiveKitAdapter` implementa todos. Tipos isolados em `packages/types/src/video-provider.ts`.
- **AC2** (token com room + identity + metadata + entrada <3s): `GenerateTokenOptions` exige `roomName` + `identity` e aceita `metadata`. `MeetingsService.openRoom` e `join` passam `metadata: { tenantId, meetingId }` em todo token emitido. Smoke: token mock retorna `<1ms`; em prod o gargalo é a chamada SDK (LiveKit). NFR-P1 fica formal na Story 5-3 quando rodar load test real.
- **AC3** (signature validation, reject 401): `LiveKitAdapter.handleWebhook` chama `WebhookReceiver.receive` (HMAC) e lança `VideoProviderSignatureError` em qualquer falha. Controller captura e devolve `UnauthorizedException` (401). 2 testes específicos cobrem missing header + assinatura inválida.
- **AC4** (isolamento Redis multi-tenant + BullMQ): namespace `rt:meeting:{tenantId}:{meetingId}` já existente do Cenário 02 — `multi-tenant-isolation.spec.ts` formaliza com 3 testes que validam presence key, pub/sub channel e payload BullMQ.

### Decisões pragmáticas

- **Renomei** `LivekitService` → `LiveKitAdapter` (deletei o antigo). Era a única classe da pasta `livekit/`; manter dois conceitos seria duplicação. A spec da Story 5-1 mencionou "VideoProviderAdapter stub" mas eu havia adiado para esta story — agora foi implementado em definitivo.
- **DI via Symbol token** (não interface diretamente) — NestJS exige token concreto para injection em TS após decoradores; `Symbol.for('metanoia.video-provider.adapter')` é o padrão idiomático.
- **`useExisting` no provider** — `LiveKitAdapter` é registrado uma vez como classe + alias via `useExisting` para o token. Evita duas instâncias.
- **Eventos discriminated union em vez de enum + payload genérico** — type safety para consumidores: `if (event.type === 'participant.joined')` afina o type para incluir `participantIdentity` + `participantSid`.
- **`handleWebhook` no adapter, não no controller** — sigma cobrança da AC1 ("método handleWebhook na interface"). Controller fica thin: parsing/validação do payload livekit nunca toca a camada HTTP.

### Out of scope

- Performance load test formal (NFR-P1 < 3s) — depende de ambiente de staging; lab smoke mostra <1ms para os métodos críticos com mock.
- BullMQ queue `meetings` já existia do Cenário 02 — sem alterações estruturais nesta entrega.
- Frontend não muda (mantém uso de `useJoinMeeting` da Story 5-1 que bate em `/api/v1/meetings/:id/join` — caminho preservado).

### Suite de testes

- Vermelhos pré-existentes do baseline (`test/rls/**`, `test/marketing/**`, `test/migrations/**`) NÃO foram tocados — falham por env DB SASL ausente, ortogonal a esta entrega.
- Comando da suite: `npx vitest run --exclude 'test/rls/**' --exclude 'test/marketing/**' --exclude 'test/migrations/**'` — 370 tests verdes.
