# Story 4.3: Convite via E-mail e Link

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to invite participants via email or shareable link,
So that new members can join groups without manual provisioning.

## Acceptance Criteria

**Given** I am Admin or Líder of a group
**When** I generate an invite link for the group
**Then** a unique token is created using `crypto.randomBytes(32).toString('base64url')` (not UUID v7, to prevent enumeration)
**And** the invite is stored in `group_invites` with: `id` (UUID v7), `group_id`, `tenant_id`, `token` (unique), `email` (nullable), `status` (enum: `pending`, `accepted`, `expired`, `revoked`), `expires_at` (7 days from creation), `created_by`, `created_at`

**Given** I send an invite via email
**When** the invite is submitted with a target email address
**Then** the email is enqueued via BullMQ job (stub implementation: logs to console in dev, real provider integration deferred to Epic 12)
**And** rate limit of 50 invites/hour per tenant is enforced via Redis `INCR` with key `rate:invite:{tenantId}` and TTL 3600s

**Given** a person receives an invite link
**When** they access the link
**Then** they are directed to register/login and automatically linked to the group upon authentication
**And** the invite status changes to `accepted`

**Given** I want to cancel a pending invite
**When** I revoke the invite
**Then** the invite status changes to `revoked` and the link becomes invalid
**And** attempting to use a revoked or expired link returns a clear error message

## Tasks / Subtasks

- [ ] Task 1: Criar migration para tabela group_invites (AC: #1, #2)
  - [ ] 1.1 Criar tabela `group_invites`: id (UUID v7), group_id, tenant_id, token (unique), email (nullable), status (enum: pending/accepted/expired/revoked), expires_at, created_by, created_at
  - [ ] 1.2 `@@map('group_invites')` e `@map` para snake_case
  - [ ] 1.3 Criar RLS policies
  - [ ] 1.4 RLS tests

- [ ] Task 2: API — gerar link de convite (AC: #1, #2)
  - [ ] 2.1 Criar `POST /api/v1/groups/:groupId/invites`
  - [ ] 2.2 Gerar token com `crypto.randomBytes(32).toString('base64url')`
  - [ ] 2.3 Definir expires_at = 7 dias
  - [ ] 2.4 Retornar 201 com invite link

- [ ] Task 3: API — enviar convite por email (AC: #3, #4)
  - [ ] 3.1 Aceitar email no body do POST
  - [ ] 3.2 Enfileirar job BullMQ para envio de email (stub: log no console)
  - [ ] 3.3 Rate limit: 50 invites/hora por tenant via Redis `INCR` com key `rate:invite:{tenantId}` e TTL 3600s

- [ ] Task 4: API — aceitar convite via link (AC: #5, #6)
  - [ ] 4.1 Criar `GET /api/v1/invites/:token` (público, redireciona para register/login)
  - [ ] 4.2 Após autenticação, linkar user ao grupo automaticamente
  - [ ] 4.3 Mudar status do invite para `accepted`

- [ ] Task 5: API — revogar convite (AC: #7, #8)
  - [ ] 5.1 Criar `PATCH /api/v1/groups/:groupId/invites/:id/revoke`
  - [ ] 5.2 Mudar status para `revoked`
  - [ ] 5.3 Link revogado retorna erro claro
  - [ ] 5.4 Link expirado retorna erro claro

- [ ] Task 6: Zod schemas e snapshot tests
  - [ ] 6.1 Criar `CreateInviteSchema` em `packages/types`
  - [ ] 6.2 Criar `InviteResponseSchema`
  - [ ] 6.3 Snapshot tests

- [ ] Task 7: Frontend — Gestão de convites
  - [ ] 7.1 Criar UI de geração de link em `apps/web/app/(authenticated)/groups/[id]/invites/`
  - [ ] 7.2 Campo para email (opcional)
  - [ ] 7.3 Lista de convites pendentes
  - [ ] 7.4 Botão de revogar
  - [ ] 7.5 Página pública de aceite de convite
  - [ ] 7.6 Testes jest-axe

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- BullMQ (queue para email)
- Redis 7 (rate limiting: `rate:*` namespace)
- crypto (Node.js built-in)
- Zod 4.3.6

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 4.1 (CRUD Grupos) — tabela groups existe
- Story 4.2 (Membros) — tabela group_members existe (para linkar após aceite)
- Story 2.1 (Cadastro) — fluxo de registro para novos users
- Story 2.2 (Login) — fluxo de login para users existentes

### Project Structure Notes
```
apps/api/src/groups/
├── invites/
│   ├── group-invites.controller.ts  # POST /groups/:id/invites, PATCH /revoke
│   ├── group-invites.service.ts
│   └── dto/
│       ├── create-invite.dto.ts
│       └── invite-response.dto.ts

apps/api/src/invites/
└── invites.controller.ts       # GET /invites/:token (public endpoint)

apps/api/prisma/migrations/
└── YYYYMMDD_create_group_invites/

packages/types/src/groups/
├── create-invite.ts
└── invite-response.ts

apps/web/app/(authenticated)/groups/[id]/invites/
├── page.tsx
└── page.spec.tsx

apps/web/app/(public)/invite/[token]/
├── page.tsx                    # Public invite acceptance page
└── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-04.md — Story 4.3]
- [Source: docs/project-context.md — Redis namespaces (rate:*), BullMQ]
- [Source: _bmad-output/planning-artifacts/architecture.md — Invites, rate limiting]
