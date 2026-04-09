# Story 2.3: MFA Obrigatório para Super Admin e Admin Tenant

Status: ready-for-dev

## Story

As a Super Admin or Admin Tenant,
I want MFA enforced on my account,
So that my elevated-privilege account is protected against unauthorized access.

## Acceptance Criteria

**Given** I am a user with role `super_admin` or `admin_tenant`
**When** I login for the first time after MFA enforcement
**Then** I am required to configure a TOTP authenticator (e.g., Google Authenticator, Authy)
**And** subsequent logins require TOTP code after email/password

**Given** I am a user with role `lider` or `participante`
**When** I login
**Then** MFA is NOT required (NFR-S5 deferred to Post-MVP for Líder)

**Given** I am a Super Admin and I enter an incorrect TOTP code
**When** the server processes the request
**Then** login is rejected with a clear message
**And** the failed MFA attempt is logged in the audit trail (Pino: `action: "auth.mfa.failed"`)

## Tasks / Subtasks

- [ ] Task 1: Configurar MFA obrigatório no Keycloak por role (AC: #1, #2)
  - [ ] 1.1 Configurar Keycloak authentication flow com MFA condicional
  - [ ] 1.2 Criar conditional flow que exige TOTP para roles `super_admin` e `admin_tenant`
  - [ ] 1.3 Configurar TOTP policy (período de 30s, 6 dígitos, SHA-1)

- [ ] Task 2: Fluxo de setup TOTP no primeiro login (AC: #1, #2)
  - [ ] 2.1 Criar tela de setup TOTP (QR code + manual entry)
  - [ ] 2.2 Integrar com Keycloak required actions
  - [ ] 2.3 Validar que TOTP funciona antes de confirmar setup

- [ ] Task 3: Garantir que lider/participante não precisam de MFA (AC: #3, #4)
  - [ ] 3.1 Verificar que conditional flow ignora roles `lider` e `participante`
  - [ ] 3.2 Escrever teste que valida login sem MFA para essas roles

- [ ] Task 4: Tratamento de TOTP incorreto (AC: #5, #6)
  - [ ] 4.1 Rejeitar login com mensagem clara em caso de TOTP incorreto
  - [ ] 4.2 Logar tentativa falha com Pino: `action: "auth.mfa.failed"`

- [ ] Task 5: Atualizar realm-export.json (AC: #1)
  - [ ] 5.1 Exportar configuração MFA do Keycloak
  - [ ] 5.2 Atualizar `infra/keycloak/realm-export.json`

- [ ] Task 6: Testes (AC: #1-#6)
  - [ ] 6.1 Teste: super_admin obrigado a configurar TOTP no primeiro login
  - [ ] 6.2 Teste: admin_tenant obrigado a configurar TOTP
  - [ ] 6.3 Teste: lider faz login sem MFA
  - [ ] 6.4 Teste: participante faz login sem MFA
  - [ ] 6.5 Teste: TOTP incorreto é rejeitado e logado

## Dev Notes

### Stack & Versões
- Keycloak 24+ (Authentication Flows, TOTP policy)
- NestJS 11.1.17
- Pino structured logging

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 2.1 (Cadastro) — usuários existem no Keycloak
- Story 2.2 (Login) — fluxo de login funcional
- Story 1.4 (Spike Keycloak) — realm configurado com roles

### Project Structure Notes
```
infra/keycloak/
└── realm-export.json           # Atualizado com MFA flows

apps/api/src/auth/
└── auth.service.ts             # MFA validation logging
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.3]
- [Source: docs/project-context.md — NFR-S5 (MFA), auth roles]
- [Source: _bmad-output/planning-artifacts/architecture.md — Authentication, MFA policy]
