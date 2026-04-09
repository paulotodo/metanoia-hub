# Story 7.1: Tela de Boas-Vindas Personalizada

Status: ready-for-dev

## Story

As a usuário (Admin/Líder/Participante),
I want a personalized welcome screen on my first access,
so that I understand the platform and know exactly what to do next.

## Acceptance Criteria

**Given** I am logging in for the first time
**When** the system detects `onboarding_completed_at` is `null` on my user record (column: `onboarding_completed_at` timestamp nullable in `users` table)
**Then** I see a welcome screen personalized for my role with a placeholder pastoral illustration (shepherd icon or similar) and exactly 1 primary CTA button:
- Admin Tenant: "Bem-vindo! Crie seu primeiro grupo e convide participantes" — CTA: "Criar Grupo"
- Líder: "Bem-vindo! Seu grupo está pronto. Explore o Radar Pastoral" — CTA: "Abrir Radar"
- Participante: "Bem-vindo! Veja seus grupos e comece a participar" — CTA: "Ver Meus Grupos" (not trilhas — Epic 8 not yet available)

**Given** I complete the onboarding flow (click CTA and reach destination)
**When** the onboarding is marked complete
**Then** `onboarding_completed_at` is set to current timestamp (not boolean — enables analytics on when users onboard)
**And** the welcome screen is not shown again on subsequent logins

**Given** the onboarding flow is timed
**When** benchmarked
**Then** Admin completes first group creation ≤ 10 min (NFR-X1), Líder reaches dashboard ≤ 3 min (NFR-X2)
**And** all text uses vocabulary from `vocabulary.ts` (Epic 6, Story 6.1)

## Tasks / Subtasks

- [ ] Task 1: Adicionar campo onboarding_completed_at na tabela users (AC: #1, #2)
  - [ ] Prisma migration: adicionar `onboarding_completed_at` timestamp nullable em `users`
  - [ ] @map("onboarding_completed_at") para snake_case
  - [ ] Sem valor default — null indica onboarding pendente
- [ ] Task 2: Implementar detecção de primeiro acesso (AC: #1)
  - [ ] Middleware ou guard que verifica `onboarding_completed_at` is null
  - [ ] Se null, redirecionar para tela de boas-vindas
  - [ ] Injetar role do usuário para personalização
- [ ] Task 3: Criar página de boas-vindas (AC: #1)
  - [ ] Criar `apps/web/src/app/(authenticated)/welcome/page.tsx`
  - [ ] Layout com ilustração pastoral placeholder
  - [ ] Mensagem personalizada por role (Admin, Líder, Participante)
  - [ ] Exatamente 1 CTA button por role
  - [ ] Strings centralizadas em `apps/web/messages/pt-BR.json`
- [ ] Task 4: Implementar CTAs por role (AC: #1)
  - [ ] Admin Tenant: CTA "Criar Grupo" → redirect para criação de grupo (Epic 4)
  - [ ] Líder: CTA "Abrir Radar" → redirect para Radar Dashboard (Epic 6)
  - [ ] Participante: CTA "Ver Meus Grupos" → redirect para listagem de grupos (Epic 4)
- [ ] Task 5: Implementar marcação de onboarding completo (AC: #2)
  - [ ] `PATCH /api/v1/users/me/onboarding-complete`
  - [ ] Set `onboarding_completed_at` = current timestamp
  - [ ] Chamar ao chegar no destino do CTA
  - [ ] Não exibir welcome screen em logins subsequentes
- [ ] Task 6: Usar vocabulário pastoral (AC: #3)
  - [ ] Todos os textos via vocabulary.ts (Story 6.1) ou centralizados em pt-BR.json
  - [ ] Tom pastoral, nunca corporativo
- [ ] Task 7: Testes (AC: #1, #2, #3)
  - [ ] Teste: primeiro login → welcome screen exibida
  - [ ] Teste: onboarding completo → welcome screen não exibida
  - [ ] Teste: CTA correto por role (Admin, Líder, Participante)
  - [ ] Teste: onboarding_completed_at é timestamp, não boolean
  - [ ] E2E: fluxo completo de onboarding por role
  - [ ] Performance: Admin ≤ 10 min (NFR-X1), Líder ≤ 3 min (NFR-X2)

## Dev Notes

- `onboarding_completed_at` é TIMESTAMP, não boolean — permite analytics de quando users completam onboarding
- Participante CTA é "Ver Meus Grupos" (não trilhas) porque Epic 8 ainda não está disponível
- Ilustração é placeholder — design final pode evoluir
- Middleware de redirecionamento deve ser leve — verificar apenas 1 campo

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
- Epic 2: Auth (user record, roles)
- Epic 4: Grupos (destino CTA Admin/Participante)
- Epic 6, Story 6.1: Vocabulário Pastoral
- Epic 6, Story 6.2: Radar Dashboard (destino CTA Líder)

### Project Structure Notes
```
apps/web/src/app/(authenticated)/welcome/
  └── page.tsx
apps/api/src/modules/onboarding/
  ├── onboarding.module.ts
  ├── onboarding.controller.ts
  └── onboarding.service.ts
apps/web/messages/pt-BR.json  (adicionar chaves de onboarding)
prisma/migrations/  (add onboarding_completed_at)
```

### References
- `_bmad-output/planning-artifacts/epics/epic-07.md` — Story 7.1
- `docs/project-context.md` — NFR-X1 (Admin ≤ 10 min), NFR-X2 (Líder ≤ 3 min)
- `docs/architecture.md` — Onboarding bounded context
