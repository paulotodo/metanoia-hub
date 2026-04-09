# Story 7.2: Dados de Demonstração Realistas

Status: ready-for-dev

## Story

As a novo tenant/líder,
I want realistic demo data pre-populated in my workspace,
so that I can see the Radar Pastoral in action and understand the platform value immediately.

## Acceptance Criteria

**Given** a new tenant is provisioned or the admin selects "Quero ver dados de exemplo" during onboarding
**When** the demo seed runs (`pnpm seed:demo`)
**Then** a dedicated demo tenant is created with `is_demo: true` flag on the `tenants` table (not per-record flags — cleanup = delete tenant with cascade)
**And** the seed is idempotent — running 2x does not duplicate data (checks if demo tenant exists before creating)

**Given** demo data is seeded
**When** the data is created
**Then** it includes:
- 1 grupo fictício ("Grupo Esperança") with ~10 participants with realistic Brazilian names (ex: "Maria Santos", "João Oliveira", "Ana Costa") and avatar placeholders with initials
- 3 historical meetings with varied attendance (integral, parcial, ausente) and realistic timestamps (last 3 weeks, not generic dates)
- Radar status distributed: ~4 verde, ~3 amarelo, ~2 vermelho, ~1 novo
- Varied trends: melhorando, estável, declínio
- 2 pastoral care actions registered
- 1 active alert (participant turned vermelho)
**And** all data uses UUID v7 and realistic timestamps
**And** demo data is RLS-isolated (does not contaminate other tenants)

**Given** the demo is seeded and a Líder logs in
**When** they complete onboarding
**Then** a guided demo walkthrough starts: Radar overview → Click a participant → View timeline → Register a care action (tour with 4 steps, skippable)
**And** the líder sees value immediately (pre-mortem gate validated)

## Tasks / Subtasks

- [ ] Task 1: Adicionar campo is_demo na tabela tenants (AC: #1)
  - [ ] Prisma migration: adicionar `is_demo` boolean default false em `tenants`
  - [ ] @map("is_demo") para snake_case
  - [ ] Cascade delete: ao deletar tenant demo, cascade deleta todos os registros
- [ ] Task 2: Criar seed script idempotente (AC: #1)
  - [ ] Criar `apps/api/prisma/seeds/demo-seed.ts`
  - [ ] Registrar como `pnpm seed:demo` no package.json
  - [ ] Verificar se tenant demo já existe antes de criar
  - [ ] Idempotente: 2x execução = mesmo resultado
- [ ] Task 3: Implementar dados fictícios realistas (AC: #2)
  - [ ] Grupo "Grupo Esperança" com ~10 participantes
  - [ ] Nomes brasileiros realistas: Maria Santos, João Oliveira, Ana Costa, Pedro Lima, etc.
  - [ ] Avatar placeholders com iniciais
  - [ ] 3 reuniões históricas (últimas 3 semanas) com timestamps realistas
  - [ ] Attendance variada: integral, parcial, ausente
  - [ ] Radar status: ~4 verde, ~3 amarelo, ~2 vermelho, ~1 novo
  - [ ] Trends variados: melhorando, estável, declínio
  - [ ] 2 ações pastorais registradas
  - [ ] 1 alerta ativo (participante ficou vermelho)
  - [ ] Todos os IDs UUID v7 via uuidv7()
- [ ] Task 4: Garantir isolamento RLS dos dados demo (AC: #2)
  - [ ] Todos os registros com tenant_id do demo tenant
  - [ ] RLS tests validando que dados demo não vazam para outros tenants
- [ ] Task 5: Implementar walkthrough guiado (AC: #3)
  - [ ] Criar componente de tour com 4 steps
  - [ ] Step 1: Radar overview
  - [ ] Step 2: Click num participante
  - [ ] Step 3: Ver timeline
  - [ ] Step 4: Registrar ação de cuidado
  - [ ] Tour é skippable (botão "Pular tour")
  - [ ] Marcar tour como concluído no user record
- [ ] Task 6: Integrar seed com onboarding (AC: #1)
  - [ ] Botão "Quero ver dados de exemplo" na tela de onboarding (Story 7.1)
  - [ ] Trigger seed via API endpoint (Admin only)
  - [ ] `POST /api/v1/tenants/seed-demo` — criar demo tenant associado
- [ ] Task 7: Testes (AC: #1, #2, #3)
  - [ ] Teste: seed idempotente — rodar 2x sem duplicar
  - [ ] Teste: dados demo isolados por RLS
  - [ ] Teste: distribuição de status correta
  - [ ] Teste: cleanup = delete tenant cascade
  - [ ] E2E: walkthrough completo com 4 steps

## Dev Notes

- Demo tenant usa `is_demo: true` flag — cleanup simples: delete cascade do tenant
- Seed deve ser idempotente — check existence before create
- Nomes brasileiros realistas — não usar "User 1", "User 2"
- Timestamps das reuniões: últimas 3 semanas com datas específicas (ex: terça-feira às 19h)
- Walkthrough pode usar library como `react-joyride` ou implementação custom simples
- `pnpm seed:demo` deve funcionar tanto local quanto em staging

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
- Story 7.1: Tela de Boas-Vindas (integração com botão de demo)
- Epic 4: Grupos (schema para grupo demo)
- Epic 5: Reuniões e Presença (meetings, attendance data)
- Epic 6: Radar Pastoral (radar status, alerts, actions)

### Project Structure Notes
```
apps/api/prisma/seeds/
  └── demo-seed.ts
apps/api/src/modules/onboarding/
  └── demo/
      ├── demo-seed.service.ts
      └── demo.controller.ts
apps/web/src/components/onboarding/
  └── walkthrough-tour.tsx
prisma/migrations/  (add is_demo to tenants)
```

### References
- `_bmad-output/planning-artifacts/epics/epic-07.md` — Story 7.2
- `docs/project-context.md` — Test factories pattern
- `docs/architecture.md` — Seed scripts, demo data strategy
