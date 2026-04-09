# Story 6.5: Componentes UX do Radar Pastoral

Status: ready-for-dev

## Story

As a Líder,
I want contextual nudges, celebration banners, undo support and a pastoral greeting,
so that the Radar feels like a pastoral care companion.

## Acceptance Criteria

**Given** a participant has 2+ consecutive meeting absences
**When** the Líder views the Radar
**Then** a `NudgePastoral` notification appears guiding toward care action (ex: "Maria não participou das últimas 2 reuniões. Que tal uma ligação?") (UX-DR07)
**And** nudge trigger rules are: 2+ consecutive absences → suggest call; status changed to vermelho → suggest visit; 7+ days inactive → suggest message

**Given** a participant transitions positively (ex: vermelho→amarelo, amarelo→verde)
**When** the Líder views the Radar
**Then** a `CelebrationBanner` appears with positive feedback (ex: "Maria voltou a participar! Seu cuidado fez diferença.") (UX-DR09)

**Given** I register or undo a pastoral care action
**When** the action is submitted
**Then** `useUndoableAction` hook + `UndoToast` provides undo capability with 5s timeout and a visible progress indicator showing remaining time (UX-DR08)

**Given** all pastoral alerts are resolved for my group
**When** I view the Radar
**Then** `InboxZeroState` shows an optimistic empty state with pastoral message (ex: "Todos os seus participantes estão bem acompanhados!") (UX-DR10)

**Given** I open the Radar for the first time in a session
**When** the dashboard loads
**Then** `SaudacaoCard` shows a contextual greeting with pastoral summary (ex: "Bom dia, Pastor Marcos. Seu grupo tem 12 pessoas, 2 precisam de atenção.") (UX-DR11)

**And** all text strings come from `vocabulary.ts` (Story 6.1)
**And** MVP priority: `SaudacaoCard` and `NudgePastoral` are required; `InboxZeroState`, `CelebrationBanner`, and `UndoToast` are nice-to-have (can be deferred under schedule pressure)

## Tasks / Subtasks

- [ ] Task 1: Criar componente NudgePastoral (AC: #1) — REQUIRED MVP
  - [ ] Criar `apps/web/src/components/pastoral/nudge-pastoral.tsx`
  - [ ] Implementar regras de trigger:
    - 2+ ausências consecutivas → sugerir ligação
    - Status mudou para vermelho → sugerir visita
    - 7+ dias inativo → sugerir mensagem
  - [ ] Texto personalizado com nome do participante
  - [ ] Usar strings de vocabulary.ts
  - [ ] CTA para registrar ação pastoral
- [ ] Task 2: Criar componente SaudacaoCard (AC: #5) — REQUIRED MVP
  - [ ] Criar `apps/web/src/components/pastoral/saudacao-card.tsx`
  - [ ] Saudação contextual baseada no horário (Bom dia/Boa tarde/Boa noite)
  - [ ] Resumo pastoral: total participantes, quantos precisam de atenção
  - [ ] Exibir apenas no primeiro acesso da sessão (Zustand `useUIStore`)
  - [ ] Usar dados do radar cache
- [ ] Task 3: Criar componente CelebrationBanner (AC: #2) — NICE-TO-HAVE
  - [ ] Criar `apps/web/src/components/pastoral/celebration-banner.tsx`
  - [ ] Feedback positivo para transições positivas
  - [ ] Texto personalizado: nome + mensagem de celebração
  - [ ] Auto-dismiss após 10s ou click
- [ ] Task 4: Criar hook useUndoableAction e UndoToast (AC: #3) — NICE-TO-HAVE
  - [ ] Criar `apps/web/src/hooks/use-undoable-action.ts`
  - [ ] Criar `apps/web/src/components/pastoral/undo-toast.tsx`
  - [ ] Timeout 5s com progress indicator visual
  - [ ] Integrar com ações pastorais (Story 6.4)
  - [ ] Cancel via undo reverte a ação no backend
- [ ] Task 5: Criar componente InboxZeroState (AC: #4) — NICE-TO-HAVE
  - [ ] Criar `apps/web/src/components/pastoral/inbox-zero-state.tsx`
  - [ ] Mensagem otimista quando todos os alertas estão resolvidos
  - [ ] Ilustração/ícone pastoral
- [ ] Task 6: Implementar lógica de nudge triggers no backend (AC: #1)
  - [ ] Endpoint `GET /api/v1/groups/:groupId/nudges` — retornar nudges ativos
  - [ ] Calcular baseado em dados de presença e radar status
  - [ ] Retornar tipo de sugestão (call, visit, message) + participante
- [ ] Task 7: Testes (AC: #1, #2, #3, #4, #5)
  - [ ] Testes unitários: nudge trigger rules
  - [ ] Teste: 2 ausências → nudge de ligação
  - [ ] Teste: status vermelho → nudge de visita
  - [ ] Teste: SaudacaoCard exibe saudação correta por horário
  - [ ] Teste: UndoToast com timeout de 5s
  - [ ] Teste: InboxZeroState quando sem alertas
  - [ ] Accessibility tests para todos os componentes

## Dev Notes

- **MVP Priority**: SaudacaoCard e NudgePastoral são OBRIGATÓRIOS. CelebrationBanner, UndoToast e InboxZeroState são nice-to-have
- Todos os textos via vocabulary.ts (Story 6.1) — nunca hardcode termos pastorais
- SaudacaoCard usa Zustand `useUIStore` para controlar exibição por sessão
- NudgePastoral: backend calcula triggers, frontend renderiza
- UndoToast: 5s timeout com visual progress (CSS animation ou Framer Motion respeitando prefers-reduced-motion)

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
- Story 6.1: Vocabulário Pastoral (todas as strings)
- Story 6.2: Semáforo e Dashboard (dados do radar)
- Story 6.3: Alertas (dados de transição para nudges e celebrations)
- Story 6.4: Ações Pastorais (integração com UndoToast)

### Project Structure Notes
```
apps/web/src/components/pastoral/
  ├── nudge-pastoral.tsx        (REQUIRED MVP)
  ├── saudacao-card.tsx         (REQUIRED MVP)
  ├── celebration-banner.tsx    (nice-to-have)
  ├── undo-toast.tsx            (nice-to-have)
  └── inbox-zero-state.tsx      (nice-to-have)
apps/web/src/hooks/
  └── use-undoable-action.ts
apps/api/src/modules/pastoral/
  └── nudges/
      └── nudges.controller.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-06.md` — Story 6.5
- UX-DR07: NudgePastoral design
- UX-DR08: UndoToast design
- UX-DR09: CelebrationBanner design
- UX-DR10: InboxZeroState design
- UX-DR11: SaudacaoCard design
