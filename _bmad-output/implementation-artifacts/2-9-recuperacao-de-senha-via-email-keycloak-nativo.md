# Story 2.9: Recuperacao de Senha via Email (Keycloak Nativo)

Status: ready-for-dev

## Story

As a user who forgot my password,
I want to reset it via an email link without needing to contact an administrator,
So that I can regain access to my account quickly and continue my pastoral workflow (FR83).

## Acceptance Criteria

**Given** I am on the login page (`(public)/login`)
**When** I cannot remember my password
**Then** I see a discrete link "Esqueci minha senha" below the password field
**And** tapping it navigates me to `(public)/recuperar-senha`

**Given** I am on the password recovery page
**When** I enter my email address and tap "Enviar link de recuperacao"
**Then** the system triggers Keycloak's native `FORGOT_PASSWORD` realm action for that email
**And** I see a generic confirmation message: "Se esse email existir na nossa base, voce vai receber um link nos proximos segundos." (anti-credential-enumeration — same message regardless of whether the email exists)
**And** no information is leaked about whether the account exists

**Given** I receive the password reset email
**When** I open it
**Then** the email uses pastoral tone (not corporate security language): subject "Marcos, aqui ta o link pra sua senha nova", body with 1 short paragraph + 1 large CTA button "Criar nova senha"
**And** the email contains NO corporate footer, NO "if you did not request this email" disclaimer, NO tracking pixels
**And** the reset token expires in 15 minutes

**Given** I tap the reset link in the email
**When** the browser opens `(public)/nova-senha/[token]`
**Then** I see 2 fields: new password + confirmation
**And** OWASP password validation runs inline (same rules as Story 2.1: minimum 8 characters, no absurd special character requirements)
**And** after successful submission, the system updates my password via Keycloak Admin API
**And** a new session is created automatically (no need to go back to login)
**And** I am redirected to my default experience route (`/app/gestao/` for Lider, `/app/admin/` for Admin Tenant, `/app/consumo/` for Participante)

**Given** I try to use an expired or already-used reset token
**When** the page loads
**Then** I see a pastoral message: "Esse link ja venceu — pede outro na tela de login."
**And** a button redirects me to `(public)/login`

**Given** I am rate-limited (too many reset requests)
**When** I try to request another reset
**Then** the system returns the same generic confirmation (no error revealing rate limit) but does not send a new email
**And** rate limiting follows Story 2.2 patterns (existing implementation)

## Tasks / Subtasks

- [ ] Task 1: API — forgot-password endpoint (AC: #1, #2)
  - [ ] 1.1 Criar `POST /api/v1/auth/forgot-password`
  - [ ] 1.2 Receber `{ email }` via Zod schema em packages/types
  - [ ] 1.3 Chamar Keycloak Admin API: trigger `FORGOT_PASSWORD` realm action
  - [ ] 1.4 Retornar resposta generica 200 (anti-credential-enumeration)
  - [ ] 1.5 Rate limiting: reusar pattern da Story 2.2 (Redis `rate:*` namespace)

- [ ] Task 2: API — reset-password endpoint (AC: #4)
  - [ ] 2.1 Criar `POST /api/v1/auth/reset-password`
  - [ ] 2.2 Receber `{ token, newPassword }` via Zod schema
  - [ ] 2.3 Validar token via Keycloak Admin API (expiry, single-use)
  - [ ] 2.4 Atualizar password via Keycloak Admin API
  - [ ] 2.5 Criar sessao automaticamente (retornar tokens)
  - [ ] 2.6 Retornar 200 com `{ data: { redirectTo } }` baseado no role do user

- [ ] Task 3: Frontend — Tela de recuperacao (AC: #1, #2)
  - [ ] 3.1 Criar `apps/web/app/(public)/recuperar-senha/page.tsx` (SSR)
  - [ ] 3.2 Input de email + botao "Enviar link de recuperacao"
  - [ ] 3.3 Exibir mensagem generica de confirmacao (PT-BR pastoral tone)
  - [ ] 3.4 Link "Esqueci minha senha" na tela de login (Story 2.2)
  - [ ] 3.5 Testes jest-axe

- [ ] Task 4: Frontend — Tela de nova senha (AC: #4, #5)
  - [ ] 4.1 Criar `apps/web/app/(public)/nova-senha/[token]/page.tsx` (SSR)
  - [ ] 4.2 2 campos: nova senha + confirmacao
  - [ ] 4.3 Validacao OWASP inline (reusar regras Story 2.1)
  - [ ] 4.4 Mensagem pastoral para token expirado/usado
  - [ ] 4.5 Redirect automatico apos sucesso (role-based)
  - [ ] 4.6 Testes jest-axe

- [ ] Task 5: Email template — Keycloak customization (AC: #3)
  - [ ] 5.1 Customizar template de email do Keycloak para password reset
  - [ ] 5.2 Tom pastoral PT-BR (nao corporate)
  - [ ] 5.3 Subject personalizado com nome do usuario
  - [ ] 5.4 CTA button "Criar nova senha"
  - [ ] 5.5 Remover footer corporativo, disclaimer, tracking pixels

## Dev Notes

### Stack & Versoes
- NestJS 11.1.17
- Next.js 16.2 (App Router, SSR)
- Keycloak Admin API (realm actions, password reset)
- Zod 4.3.6

### Guardrails Arquiteturais
- Multi-tenancy: NAO se aplica — recovery e per-user, nao per-tenant
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validacao: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS) — mas rotas de recovery sao publicas
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 2.1 (Cadastro) — regras OWASP de senha reutilizadas
- Story 2.2 (Login) — link "Esqueci minha senha" adicionado na tela de login + rate limiting pattern

### No New Tables
Password reset e gerenciado 100% pelo Keycloak (tokens, expiracao, validacao). Nenhuma tabela PostgreSQL adicional necessaria.

### Project Structure Notes
```
apps/api/src/auth/
├── auth.controller.ts          # POST /auth/forgot-password, POST /auth/reset-password
├── auth.service.ts             # Keycloak Admin API calls
└── dto/
    ├── forgot-password.dto.ts  # { email: z.string().email() }
    └── reset-password.dto.ts   # { token: z.string(), newPassword: z.string() }

apps/web/app/(public)/
├── recuperar-senha/
│   ├── page.tsx
│   └── page.spec.tsx
└── nova-senha/
    └── [token]/
        ├── page.tsx
        └── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.9]
- [Source: docs/prd.md — FR83]
- [Source: design-process/C-UX-Scenarios/07-lider-recupera-acesso.md — Origin scenario]
