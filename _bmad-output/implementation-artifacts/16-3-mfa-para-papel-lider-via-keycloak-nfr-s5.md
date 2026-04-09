# Story 16.3: MFA para Papel Líder via Keycloak (NFR-S5)

Status: ready-for-dev

## Story

As a Super Admin,
I want to enforce MFA (TOTP) for all users with the Líder role,
So that pastoral care data is protected by an additional authentication factor.

## Acceptance Criteria

**Given** a user is assigned the role Líder in Keycloak
**When** they log in for the first time after MFA enforcement
**Then** Keycloak redirects them to the TOTP setup flow (required action: `CONFIGURE_TOTP`)
**And** the setup page shows: QR code for authenticator app (Google Authenticator, Authy, etc.), manual entry code as fallback, and step-by-step instructions in PT-BR
**And** the user must successfully enter a valid TOTP code to complete setup
**And** after setup, 10 one-time recovery codes are generated and displayed ONCE with a "Copiar todos" button and a warning: "Guarde estes códigos em local seguro. Eles não serão exibidos novamente."

**Given** a Líder with MFA configured logs in
**When** they enter valid credentials
**Then** Keycloak prompts for the TOTP code as a second factor
**And** the TOTP input accepts 6-digit codes with a 30-second window (±1 step tolerance per RFC 6238)
**And** if the code is invalid, the error message says "Código inválido. Tente novamente." (no timing leaks)
**And** after 5 consecutive failed attempts, the account is locked for 15 minutes with message: "Conta temporariamente bloqueada. Tente novamente em 15 minutos."

**Given** a Líder has lost their authenticator device
**When** they click "Usar código de recuperação" on the TOTP screen
**Then** they can enter one of their 10 recovery codes
**And** each recovery code can only be used once (marked as consumed in Keycloak)
**And** after using a recovery code, the user is prompted to set up a new TOTP device
**And** if all 10 recovery codes are consumed, the Líder must contact a Super Admin to reset MFA

**Given** a "break glass" scenario where both the Líder AND Super Admin are locked out
**When** recovery is needed
**Then** a documented procedure exists in `docs/operations/mfa-break-glass.md` describing: direct access to Keycloak Admin Console (separate from the application), steps to reset TOTP credentials for any user, and required infrastructure credentials
**And** the break-glass procedure requires 2-person authorization (infrastructure team, not application-level) to prevent single-point-of-failure
**And** every break-glass access is logged in the audit log as `auth.mfa.break-glass-reset` with the identity of who performed it

**Given** a Super Admin accesses the user management at `/app/admin/usuarios`
**When** they view a Líder's profile
**Then** MFA status is visible: "MFA ativo" / "MFA pendente de configuração"
**And** the Super Admin can reset MFA for the Líder (generates new required action) with a confirmation dialog: "Isso removerá o MFA atual. O líder precisará configurar novamente no próximo login."
**And** a domain event `auth.user.mfa-reset` is emitted and logged in the audit log

**Given** MFA enforcement is configured in Keycloak
**When** the configuration is applied
**Then** MFA is enforced ONLY for the Líder role (not Participante, not Super Admin — Super Admin MFA is a separate future decision)
**And** the Keycloak realm configuration uses conditional authentication flow: `role:lider` → require TOTP
**And** the NestJS auth guard does NOT implement MFA logic — Keycloak handles it entirely (no custom MFA code in the application)

## Tasks / Subtasks

- [ ] Task 1: Configure Keycloak conditional authentication flow (AC: #1, #6)
  - [ ] Create conditional auth flow: `role:lider` → require TOTP
  - [ ] Configure required action `CONFIGURE_TOTP` for Líder role
  - [ ] Enforce ONLY for Líder (not Participante, not Super Admin)
  - [ ] Export realm configuration for reproducibility
- [ ] Task 2: Customize Keycloak TOTP setup page (AC: #1)
  - [ ] PT-BR translations for setup page
  - [ ] QR code + manual entry code display
  - [ ] Step-by-step instructions
  - [ ] Generate and display 10 recovery codes with "Copiar todos" button
  - [ ] Warning message about recovery codes
- [ ] Task 3: Configure TOTP validation and lockout (AC: #2)
  - [ ] 6-digit code, 30-second window (±1 step tolerance per RFC 6238)
  - [ ] Error message: "Código inválido. Tente novamente." (no timing leaks)
  - [ ] Account lockout after 5 consecutive failures for 15 minutes
- [ ] Task 4: Implement recovery code flow (AC: #3)
  - [ ] Enable recovery code authentication in Keycloak
  - [ ] Single-use recovery codes (consumed on use)
  - [ ] Prompt for new TOTP setup after recovery code use
- [ ] Task 5: Create break-glass procedure documentation (AC: #4)
  - [ ] Write `docs/operations/mfa-break-glass.md`
  - [ ] Document Keycloak Admin Console access steps
  - [ ] Define 2-person authorization requirement
  - [ ] Implement audit log event `auth.mfa.break-glass-reset`
- [ ] Task 6: Implement Super Admin MFA management UI (AC: #5)
  - [ ] Show MFA status on Líder profile: "MFA ativo" / "MFA pendente"
  - [ ] "Reset MFA" button with confirmation dialog
  - [ ] Call Keycloak Admin API to reset TOTP credentials
  - [ ] Emit `auth.user.mfa-reset` domain event
  - [ ] Log in audit log
- [ ] Task 7: Write tests (AC: all)
  - [ ] Integration tests using Keycloak Testcontainers (`@testcontainers/keycloak`) with pre-configured realm export
  - [ ] First login test: Líder → verify TOTP setup redirect
  - [ ] TOTP validation: valid code → success, expired code → fail, reused recovery code → fail
  - [ ] Lockout test: 5 invalid codes → 15min lock → unlock after timeout
  - [ ] Super Admin test: reset MFA → Líder prompted again on next login
  - [ ] Role isolation: Participante login → NO MFA prompt
  - [ ] Keycloak config test: conditional auth flow targets correct role
  - [ ] Audit test: verify `auth.user.mfa-reset` event logged
  - [ ] NestJS guard unit tests: mock JWT token (MFA is Keycloak's responsibility)

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Architecture Decision
- MFA is handled ENTIRELY by Keycloak — NestJS auth guard does NOT implement MFA logic
- No custom MFA code in the application
- Conditional authentication flow in Keycloak realm configuration

### Dependencies
- Epic 2 (Keycloak setup, auth infrastructure)
- Keycloak Testcontainers for integration tests

### Project Structure Notes
- Keycloak config: `infra/keycloak/realm-export.json` (updated with conditional auth flow)
- Break-glass docs: `docs/operations/mfa-break-glass.md`
- Admin UI: `apps/web/app/(authenticated)/admin/usuarios/[id]/page.tsx` (MFA status section)
- Test fixtures: `apps/api/test/fixtures/keycloak-realm.json`
- Backend: `apps/api/src/modules/auth/` (guards only validate token, no MFA logic)

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-16.md` (Story 16.3)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
