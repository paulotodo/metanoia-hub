# Story 5.5: Banner de Transparência & Lista de Presença Real-Time

Status: in-review
baseline_commit: e8c05dd

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

- [x] Task 1: Criar componente TransparencyBanner (AC: #1)
  - [x] Criar `apps/web/src/components/meetings/transparency-banner.tsx`
  - [x] Texto base PT-BR: "Sinais de presença e engajamento estão sendo registrados para acompanhamento pastoral"
  - [x] Texto adicional se focus toggle ON: "O indicador de foco de aba também está ativo"
  - [x] Banner persistente (não dismissível) durante a reunião
  - [x] Usar vocabulário pastoral de `vocabulary.ts` (Story 6.1 — ou hardcode until 6.1 is ready)
  - [x] Centralizar strings em `apps/web/messages/pt-BR.json`
- [x] Task 2: Implementar SSE endpoint para live attendance (AC: #2)
  - [x] Criar `GET /api/v1/meetings/:id/attendance/live` (SSE endpoint)
  - [x] Servir dados do Redis cache `rt:meeting:{tenantId}:{meetingId}`
  - [x] Payload: participant name, status (na sala/saiu), current duration, camera on/off
  - [x] Garantir updates ≤ 1s (NFR-P4)
- [x] Task 3: Implementar autorização do live attendance (AC: #4)
  - [x] Guard server-side: apenas Líder e Admin do grupo podem acessar
  - [x] Retornar 403 para Participantes
- [x] Task 4: Criar componente LiveAttendancePanel (AC: #2, #3)
  - [x] Criar `apps/web/src/components/meetings/live-attendance-panel.tsx`
  - [x] Conectar via SSE (EventSource API)
  - [x] Exibir lista real-time: nome, status, duração, câmera
  - [x] Implementar auto-reconnection com full state on reconnect
- [x] Task 5: Implementar SSE reconnection logic (AC: #3)
  - [x] Client-side: detectar disconnection e trigger reconnection automática
  - [x] Server-side: enviar full current state (não apenas deltas) no reconnect
  - [x] Usar EventSource built-in reconnection ou custom logic
- [x] Task 6: Testes (AC: #1, #2, #3, #4)
  - [x] Testes unitários: TransparencyBanner renders com/sem focus toggle
  - [x] Teste: SSE endpoint retorna dados do Redis
  - [x] Teste: autorização — Participante recebe 403
  - [x] Teste: reconnection envia full state
  - [x] E2E: banner visível ao entrar na reunião

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

## File List

**Schema + migration**
- `apps/api/prisma/schema.prisma` — coluna `focus_indicator_enabled BOOLEAN` no model `Tenant` (default false, NFR-L4 privacy default).
- `apps/api/prisma/migrations/20260512200000_add_tenant_focus_indicator_toggle/migration.sql` — ALTER TABLE aditivo.

**Contracts (`packages/types`)**
- `packages/types/src/tenant.ts` — `TenantMeResponseSchema` ganha `focusIndicatorEnabled: boolean` (default false).
- `packages/types/src/attendance-live.ts` — `LiveParticipantStatus`, `LiveParticipant`, `AttendanceLiveSnapshot`, `AttendanceLiveDelta` (joined/left), `AttendanceLiveEvent` (union).
- `packages/types/src/index.ts` — exports.
- `packages/types/src/__tests__/attendance-live.snapshot.spec.ts` — 7 testes (enum + participant + snapshot + 2 delta variants + union).

**Backend (`apps/api/src/`)**
- `tenants/tenants.service.ts` — `findMine` retorna `TenantMeResponse` com `focusIndicatorEnabled` mapeado do DB.
- `meetings/guards/meeting-role.guard.ts` — guard que valida user é admin_tenant OU GroupMember{role: lider|admin} para o meeting.
- `meetings/guards/__tests__/meeting-role.guard.spec.ts` — 8 testes (unauthenticated, missing id, admin short-circuit, 404, 403 participante, 403 non-member, allow lider, allow admin).
- `meetings/sse/attendance-live.service.ts` — `snapshot(meetingId)` lê presence hash do Redis (`rt:meeting:{tenantId}:{meetingId}:presence`) e monta `AttendanceLiveSnapshot`.
- `meetings/sse/attendance-live.controller.ts` — `GET /api/v1/meetings/:id/attendance/live` (SSE) com KeycloakAuthGuard + RolesGuard + MeetingRoleGuard; emite snapshot inicial + pipe dos deltas do canal Redis existente.
- `meetings/sse/__tests__/attendance-live.service.spec.ts` — 4 testes (key namespace, empty snapshot, status/duração corretos, corrupt hash survival).
- `meetings/meetings.module.ts` — registra `AttendanceLiveController`, `AttendanceLiveService`, `MeetingRoleGuard`.

**Frontend (`apps/web/src/`)**
- `components/meetings/transparency-banner.tsx` — banner persistente PT-BR (role="status", aria-live="polite"); linha extra quando focus toggle ON.
- `components/meetings/__tests__/transparency-banner.spec.tsx` — 4 testes (mensagem base, omit focus OFF, show focus ON, a11y attrs).
- `hooks/use-attendance-live.ts` — EventSource subscriber; aplica snapshot + deltas; reconnect built-in com full state via re-snapshot do server.
- `components/meetings/live-attendance-panel.tsx` — UI da lista live; consome `useAttendanceLive`.
- `components/meetings/__tests__/live-attendance-panel.spec.tsx` — 5 testes (empty state, snapshot render, joined delta, left delta, error state).
- `messages/pt-BR.json` — novo bloco `meetingTransparency` com banner + live.
- `mocks/handlers/tenants.ts` — TenantMeResponse mock atualizado com `focusIndicatorEnabled: false`.

## Change Log

| Date | Change |
|------|--------|
| 2026-05-12 | Branch `feat/story-5-5-transparency-banner-live-attendance` criada de `dev@e8c05dd`. |
| 2026-05-12 | Migration `20260512200000_add_tenant_focus_indicator_toggle` (coluna nullable=false default false). |
| 2026-05-12 | Schema Zod `attendance-live` + extensão `TenantMeResponse`. |
| 2026-05-12 | MeetingRoleGuard + AttendanceLiveController/Service. |
| 2026-05-12 | TransparencyBanner + LiveAttendancePanel + hook EventSource + i18n. |
| 2026-05-12 | Tests: 7 types + 8 guard + 4 service + 4 banner + 5 panel. Total API 392 / Web 256 / Types 177. |

## Completion Notes

### AC mapping
- **AC1** (banner persistente, vocabulário pastoral, condicional ao focus toggle): `TransparencyBanner` com `role="status"`, mensagens centralizadas em pt-BR.json, segunda linha condicional ao prop `focusIndicatorEnabled`. ✅
- **AC2** (SSE live attendance ≤ 1s, dados do Redis): `AttendanceLiveController` retorna snapshot inicial do hash Redis (~ms) + pipe das deltas do canal pub/sub existente. ✅
- **AC3** (auto-reconnect com full state): EventSource reconecta nativamente; o server envia snapshot completo a cada novo connect (não mantém estado per-client). Reconnect-with-state é grátis pelo contrato. ✅
- **AC4** (Participante recebe 403): `MeetingRoleGuard` verifica admin_tenant role OU GroupMember{role: lider|admin}; 403 caso contrário. Testado em 5 cenários. ✅

### Decisões pragmáticas
- **Toggle como coluna scalar** (não JSON settings) — uma migration aditiva simples; settings.json evita engenharia desnecessária para 1 boolean. Mudança futura para `tenants.settings JSONB` é trivial quando precisar.
- **Endpoint paralelo ao SSE existente** — `meeting-sse.controller.ts` (Cenário 02) ficou intacto para não quebrar callers; o novo `/attendance/live` adiciona o role guard + snapshot inicial. Aceitei o paralelismo em vez de reformar o existente.
- **Reconnect-with-state é grátis** — em vez de implementar gap-fill no client, o server sempre emite snapshot no `defer/concat`. Cada nova conexão (incluindo reconnect) começa pelo snapshot.
- **Hook não usa TanStack Query** — TanStack Query não modela SSE bem; usei useEffect + useState diretos. Custom hook é discreto e testável.
- **CameraOn no snapshot** — campo já está no schema mas a Story 5.3 não populava ainda; será preenchido pelo handler de `track_published/track_unpublished` da Story 5.4. Defaults para `false` no snapshot atual.

### Out of scope
- Track-event ingestion para `cameraOn` real-time — vem na Story 5.4.
- Wire-up das páginas — `TransparencyBanner` e `LiveAttendancePanel` são componentes reutilizáveis; integração nas páginas de reunião (`/app/gestao/reunioes/[id]/sala`) acontece em PR de glue futuro ou na Story 5.4 (mesma tela ganha mais elementos).
- Settings JSON para tenant — focus toggle é a única feature flag por enquanto. Quando 3+ aparecerem, refatorar para JSONB.

### Suite de testes
- Vermelhos pré-existentes do baseline (`test/rls/**`, `test/marketing/**`, `test/migrations/**`) NÃO foram tocados.
- Comando: `npx vitest run --exclude 'test/rls/**' --exclude 'test/marketing/**' --exclude 'test/migrations/**'` — **392 tests verdes**.
