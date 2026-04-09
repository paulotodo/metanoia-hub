# Story 6.4: Perfil Consolidado & Ações de Cuidado Pastoral

Status: ready-for-dev

## Story

As a Líder,
I want to view a participant's consolidated profile and register pastoral care actions,
so that I have full context before reaching out and can track my pastoral efforts.

## Acceptance Criteria

**Given** I am Líder viewing the Radar
**When** I expand a participant's `ParticipantCard` (UX-DR05)
**Then** I see: name, photo, semáforo, trend, last meeting attended, average permanence time (read from `meeting_telemetry` — Epic 5), and pastoral context
**And** the card expands to show `TimelineCuidado` in reverse chronological order (most recent first): signals (presence/absence) → care actions registered → results (UX-DR06, chronological mode MVP)

**Given** no care actions have been registered for a participant
**When** the TimelineCuidado is displayed
**Then** an encouraging empty state message appears: "Nenhuma ação de cuidado registrada. Que tal começar com uma mensagem?" (pastoral tone, from vocabulary.ts)

**Given** I want to register a pastoral care action
**When** I submit the action form
**Then** the action is stored in `pastoral_actions`: `id` (UUID v7), `tenant_id`, `group_id`, `participant_id`, `leader_id`, `action_type` (enum: `ligacao`, `visita`, `mensagem`, `oracao`, `outro`), `description`, `action_date`, `created_at`
**And** the timeline updates immediately with the new action
**And** RLS ensures pastoral actions are isolated per tenant

**Given** the profile shows trail progress
**When** Epic 8 is not yet implemented
**Then** trail progress section shows "Em breve" placeholder

## Tasks / Subtasks

- [ ] Task 1: Criar Prisma schema para `pastoral_actions` (AC: #3)
  - [ ] Model PastoralAction: id, tenant_id, group_id, participant_id, leader_id, action_type (enum), description, action_date, created_at
  - [ ] Enum PastoralActionType: ligacao, visita, mensagem, oracao, outro
  - [ ] UUID v7, @@map("pastoral_actions")
  - [ ] Migration com RLS policy
- [ ] Task 2: Implementar endpoints de perfil consolidado (AC: #1)
  - [ ] `GET /api/v1/groups/:groupId/participants/:participantId/profile`
  - [ ] Agregar dados: nome, foto, semáforo, trend, última reunião, permanência média
  - [ ] Ler meeting_telemetry para permanência média (Epic 5)
  - [ ] Repository pattern (Core Domain)
- [ ] Task 3: Implementar endpoints de ações pastorais (AC: #3)
  - [ ] `POST /api/v1/groups/:groupId/participants/:participantId/actions` — criar ação
  - [ ] `GET /api/v1/groups/:groupId/participants/:participantId/actions` — listar ações
  - [ ] Validação Zod: action_type obrigatório, description obrigatória
- [ ] Task 4: Implementar endpoint de timeline (AC: #1, #2)
  - [ ] `GET /api/v1/groups/:groupId/participants/:participantId/timeline`
  - [ ] Mesclar: sinais de presença + ações pastorais, ordem cronológica reversa
  - [ ] Retornar tipo de evento (signal/action) para renderização diferenciada
- [ ] Task 5: Criar componente ParticipantCard (AC: #1)
  - [ ] Criar `apps/web/src/components/pastoral/participant-card.tsx`
  - [ ] Exibir: nome, foto, SemaforoPill, TrendIndicator, última reunião, permanência
  - [ ] Expandível para mostrar TimelineCuidado
  - [ ] UX-DR05 reference
- [ ] Task 6: Criar componente TimelineCuidado (AC: #1, #2)
  - [ ] Criar `apps/web/src/components/pastoral/timeline-cuidado.tsx`
  - [ ] Ordem cronológica reversa (mais recente primeiro)
  - [ ] Tipos de item: signal (presença/ausência), action (ação pastoral), result
  - [ ] Empty state pastoral: "Nenhuma ação de cuidado registrada. Que tal começar com uma mensagem?"
  - [ ] Usar strings de vocabulary.ts
- [ ] Task 7: Criar formulário de ação pastoral (AC: #3)
  - [ ] Criar `apps/web/src/components/pastoral/action-form.tsx`
  - [ ] Select para action_type, textarea para description, date picker para action_date
  - [ ] Optimistic update na timeline após submit
- [ ] Task 8: Placeholder "Em breve" para trilhas (AC: #4)
  - [ ] Seção de progresso de trilhas com placeholder
  - [ ] Texto: "Em breve" — será substituído quando Epic 8 estiver completo
- [ ] Task 9: Testes (AC: #1, #2, #3, #4)
  - [ ] Testes unitários: agregação de perfil, timeline ordering
  - [ ] Teste: empty state quando sem ações
  - [ ] Teste: criar ação e ver na timeline
  - [ ] RLS isolation tests para pastoral_actions
  - [ ] Snapshot tests dos Zod schemas

## Dev Notes

- TimelineCuidado é MVP em modo cronológico — sem agrupamento por categoria
- Permanência média vem de meeting_telemetry (Epic 5) — query cross-module
- Optimistic update na timeline: usar TanStack Query `onMutate` para atualização imediata
- Placeholder "Em breve" para trilhas — remover quando Epic 8 completar
- Todos os textos pastorais via vocabulary.ts (Story 6.1)

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
- Story 6.1: Vocabulário Pastoral (strings)
- Story 6.2: Semáforo (SemaforoPill, participant_radar_status)
- Story 6.3: Tendência e Alertas (TrendIndicator)
- Epic 5 (Stories 5.3-5.4): Dados de presença e telemetria

### Project Structure Notes
```
apps/api/src/modules/pastoral/
  ├── profile/
  │   ├── profile.service.ts
  │   └── profile.controller.ts
  ├── actions/
  │   ├── actions.service.ts
  │   └── actions.controller.ts
  ├── timeline/
  │   └── timeline.service.ts
  └── dto/
      ├── pastoral-action.dto.ts
      └── profile.dto.ts
packages/types/src/pastoral/
  ├── pastoral-action.schema.ts
  └── action-type.enum.ts
apps/web/src/components/pastoral/
  ├── participant-card.tsx
  ├── timeline-cuidado.tsx
  └── action-form.tsx
apps/api/test/rls/
  └── pastoral-actions.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-06.md` — Story 6.4
- UX-DR05: ParticipantCard design
- UX-DR06: TimelineCuidado chronological mode
- `docs/architecture.md` — Pastoral bounded context
