# Story 2.8: Consentimento LGPD e Termos de Uso (Middleware)

Status: ready-for-dev

## Story

As a new user,
I want to review and accept the privacy policy and terms of use on my first access,
So that the platform collects my data with my explicit consent as required by LGPD (FR72, FR75, NFR-L3).

## Acceptance Criteria

**Given** I am completing registration via email (Story 2.1) OR logging in via Google OAuth for the first time (Story 2.2)
**When** the system detects I have no consent recorded
**Then** I am redirected to the consent screen before I can access any app functionality
**And** this redirect is implemented as a frontend middleware that checks consent status on every authenticated route

**Given** I am on the consent screen
**When** I view the documents
**Then** I see the privacy policy and terms of use as readable, scrollable documents (not just checkboxes)
**And** I must explicitly accept each document (separate checkboxes for privacy policy and terms of use)
**And** I cannot proceed to the app without accepting both

**Given** I accept the consent
**When** the system processes my acceptance
**Then** the consent timestamp, version of the documents, IP address, and user agent are recorded in the `consents` table
**And** the consent record is associated with my user ID and is immutable (append-only, no updates or deletes)
**And** I am redirected to tenant selection (Story 2.5) or the app dashboard

**Given** the privacy policy or terms are updated to a new version
**When** I next login
**Then** I am shown the updated documents and must re-accept before continuing
**And** my previous consent record is preserved (for audit trail) and a new record is created

**Given** I want to access the privacy policy or terms of use at any time
**When** I navigate to the footer or settings area
**Then** the current versions are accessible and readable without requiring re-acceptance

## Tasks / Subtasks

- [ ] Task 1: API — verificar status de consentimento (AC: #1, #2)
  - [ ] 1.1 Criar `GET /api/v1/consent/status` que retorna se user tem consent válido
  - [ ] 1.2 Verificar versão atual dos documentos vs última versão aceita
  - [ ] 1.3 Retornar `{ hasConsent: boolean, pendingDocuments: [...] }`

- [ ] Task 2: API — registrar consentimento (AC: #7, #8, #9)
  - [ ] 2.1 Criar `POST /api/v1/consent/accept`
  - [ ] 2.2 Registrar timestamp, versão do documento, IP, user agent
  - [ ] 2.3 Associar ao user_id
  - [ ] 2.4 Garantir imutabilidade: append-only (sem UPDATE/DELETE na consents)
  - [ ] 2.5 Retornar 201 com confirmação

- [ ] Task 3: Frontend middleware de consent check (AC: #2, #3)
  - [ ] 3.1 Criar middleware Next.js que verifica consent em rotas autenticadas
  - [ ] 3.2 Redirecionar para tela de consent se pendente
  - [ ] 3.3 Cachear status de consent na sessão

- [ ] Task 4: Frontend — Tela de consentimento (AC: #4, #5, #6)
  - [ ] 4.1 Criar `apps/web/app/(auth)/consent/page.tsx`
  - [ ] 4.2 Exibir política de privacidade como documento scrollable
  - [ ] 4.3 Exibir termos de uso como documento scrollable
  - [ ] 4.4 Checkboxes separados para cada documento
  - [ ] 4.5 Botão "Aceitar" habilitado apenas quando ambos estão marcados
  - [ ] 4.6 Testes jest-axe

- [ ] Task 5: Re-consentimento em nova versão (AC: #10, #11, #12)
  - [ ] 5.1 Implementar versionamento de documentos
  - [ ] 5.2 Detectar nova versão no login e forçar re-aceite
  - [ ] 5.3 Preservar consent anterior (audit trail)
  - [ ] 5.4 Criar novo registro de consent

- [ ] Task 6: Acesso público aos documentos (AC: #13, #14)
  - [ ] 6.1 Criar `GET /api/v1/legal/privacy-policy` (público)
  - [ ] 6.2 Criar `GET /api/v1/legal/terms-of-use` (público)
  - [ ] 6.3 Link no footer e settings

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Next.js 16.2 Middleware (App Router)
- Prisma v7
- Zod 4.3.6

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 2.1 (Cadastro) — tabela consents criada
- Story 2.2 (Login) — fluxo de login (redireciona para consent se necessário)
- Story 2.5 (Tenant Selection) — redirect após consent aceito

### Project Structure Notes
```
apps/api/src/consent/
├── consent.module.ts
├── consent.controller.ts       # GET /consent/status, POST /consent/accept
├── consent.service.ts
└── dto/
    └── consent.dto.ts

apps/api/src/legal/
├── legal.module.ts
└── legal.controller.ts         # GET /legal/privacy-policy, GET /legal/terms-of-use

apps/web/
├── middleware.ts                # Consent check middleware
└── app/(auth)/consent/
    ├── page.tsx
    └── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.8]
- [Source: docs/project-context.md — FR72, FR75, NFR-L3, LGPD]
- [Source: _bmad-output/planning-artifacts/architecture.md — Consent flow, LGPD compliance]
