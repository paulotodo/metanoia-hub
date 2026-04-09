# Story 5.5: Banner de Transparência & Lista de Presença Real-Time

Status: ready-for-dev

## Story

As a Participante/Líder,
I want to see a transparency banner during meetings and the leader to see live attendance,
so that participants know what is being tracked and leaders have real-time visibility.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Criar componente TransparencyBanner (AC: #1)
  - [ ] Criar `apps/web/src/components/meetings/transparency-banner.tsx`
  - [ ] Texto base PT-BR: "Sinais de presença e engajamento estão sendo registrados para acompanhamento pastoral"
  - [ ] Texto adicional se focus toggle ON: "O indicador de foco de aba também está ativo"
  - [ ] Banner persistente (não dismissível) durante a reunião
  - [ ] Usar vocabulário pastoral de `vocabulary.ts` (Story 6.1 — ou hardcode until 6.1 is ready)
  - [ ] Centralizar strings em `apps/web/messages/pt-BR.json`
- [ ] Task 2: Implementar SSE endpoint para live attendance (AC: #2)
  - [ ] Criar `GET /api/v1/meetings/:id/attendance/live` (SSE endpoint)
  - [ ] Servir dados do Redis cache `rt:meeting:{tenantId}:{meetingId}`
  - [ ] Payload: participant name, status (na sala/saiu), current duration, camera on/off
  - [ ] Garantir updates ≤ 1s (NFR-P4)
- [ ] Task 3: Implementar autorização do live attendance (AC: #4)
  - [ ] Guard server-side: apenas Líder e Admin do grupo podem acessar
  - [ ] Retornar 403 para Participantes
- [ ] Task 4: Criar componente LiveAttendancePanel (AC: #2, #3)
  - [ ] Criar `apps/web/src/components/meetings/live-attendance-panel.tsx`
  - [ ] Conectar via SSE (EventSource API)
  - [ ] Exibir lista real-time: nome, status, duração, câmera
  - [ ] Implementar auto-reconnection com full state on reconnect
- [ ] Task 5: Implementar SSE reconnection logic (AC: #3)
  - [ ] Client-side: detectar disconnection e trigger reconnection automática
  - [ ] Server-side: enviar full current state (não apenas deltas) no reconnect
  - [ ] Usar EventSource built-in reconnection ou custom logic
- [ ] Task 6: Testes (AC: #1, #2, #3, #4)
  - [ ] Testes unitários: TransparencyBanner renders com/sem focus toggle
  - [ ] Teste: SSE endpoint retorna dados do Redis
  - [ ] Teste: autorização — Participante recebe 403
  - [ ] Teste: reconnection envia full state
  - [ ] E2E: banner visível ao entrar na reunião

## Dev Notes

- SSE (Server-Sent Events) para real-time — não WebSocket (exceto heartbeat de focus da Story 5.4)
- Redis cache `rt:meeting:{tenantId}:{meetingId}` é fonte de verdade durante a reunião
- NFR-P4: latência de updates ≤ 1s — dados servidos diretamente do Redis
- Banner é prerequisite para coleta de focus (Story 5.4 — privacy guarantee)
- Strings PT-BR centralizadas em `apps/web/messages/pt-BR.json`

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
- Story 5.1: CRUD de Reuniões (meeting view)
- Story 5.2: Integração LiveKit (webhook events alimentam Redis)
- Story 5.3: Pipeline de Presença (Redis state)
- Epic 1, Story 1.6: Spike Pipeline Real-time (SSE pattern)

### Project Structure Notes
```
apps/web/src/components/meetings/
  ├── transparency-banner.tsx
  └── live-attendance-panel.tsx
apps/api/src/modules/meetings/
  ├── sse/
  │   └── attendance-sse.controller.ts
  └── guards/
      └── meeting-role.guard.ts
apps/web/messages/pt-BR.json  (adicionar chaves de meeting)
```

### References
- `_bmad-output/planning-artifacts/epics/epic-05.md` — Story 5.5
- `docs/project-context.md` — NFR-P4 (latência ≤ 1s)
- `docs/architecture.md` — SSE pattern, Redis real-time
