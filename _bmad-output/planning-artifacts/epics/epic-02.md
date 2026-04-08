## Epic 2: Identidade, Acesso & Multi-tenancy

Usuário pode se cadastrar (email/Google), fazer login, selecionar tenant, ter dados isolados por RLS. Admin gerencia usuários e papéis. Consentimento LGPD e termos de uso no cadastro. Autorização em 3 camadas independentes.

### Story 2.1: Cadastro de Usuário com Email e Senha

As a new user,
I want to register with my email and password,
So that I can create an account and access the platform.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I submit a valid email and password (minimum 12 characters, max 64+)
**Then** a migration creates tables `users`, `user_tenants`, and `consents` (if not yet created) with `tenant_id`, UUID v7 PKs, and RLS policies
**And** my account is created in Keycloak and a user record is persisted in PostgreSQL with UUID v7
**And** my password is validated against the OWASP/NIST leaked password list — common/leaked passwords are rejected with a clear message (NFR-S3)
**And** my password is stored with Argon2id hash in Keycloak (NFR-S1)
**And** I receive a confirmation email to verify my account
**And** the registration page passes jest-axe accessibility tests

**Given** I submit an email that already exists
**When** the server processes the request
**Then** I see a clear error message without revealing whether the email is registered (security best practice)

**Given** I submit a password shorter than 12 characters or longer than 64 characters
**When** the server processes the request
**Then** I see a clear validation error explaining the password requirements (NFR-S2)

### Story 2.2: Login via Email/Senha e Google OAuth

As a registered user,
I want to login with my email/password or Google account,
So that I can access my account securely.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I submit valid email and password credentials
**Then** I receive a JWT token from Keycloak with `realm_roles`, `tenant_id`, and `user_id` claims
**And** the session is established with high-entropy session ID (NFR-S9)
**And** I am redirected to tenant selection (if multiple tenants) or the app dashboard

**Given** I am on the login page
**When** I click "Login with Google"
**Then** I am redirected to Google OAuth flow via Keycloak
**And** upon successful Google authentication, I receive a valid JWT with the same claims
**And** if this is my first Google login, a user record is created in PostgreSQL
**And** if this is my first login (no consent recorded), I am redirected to the LGPD consent flow (Story 2.8) before accessing the app

**Given** I submit invalid credentials
**When** the server processes the request
**Then** I see a generic error message "Email ou senha incorretos" (no credential enumeration)
**And** failed login attempts are logged in the audit trail (Pino structured log with `action: "auth.login.failed"`)

**Given** the CI pipeline runs Google OAuth tests
**When** the test suite executes
**Then** a mock identity provider is configured in Keycloak for CI (simulating Google OAuth flow without real Google credentials)
**And** the mock IdP test validates the full flow: redirect → callback → JWT issued → user created

### Story 2.3: MFA Obrigatório para Super Admin e Admin Tenant

As a Super Admin or Admin Tenant,
I want MFA enforced on my account,
So that my elevated-privilege account is protected against unauthorized access.

**Acceptance Criteria:**

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

### Story 2.4: Autorização por Papéis e Guards NestJS (3 Camadas)

As a platform operator,
I want role-based access control enforced at 3 independent layers,
So that users can only access resources permitted by their role and tenant context (FR05, FR09).

**Acceptance Criteria:**

**Given** the 3-layer authorization is configured
**When** a request reaches the API
**Then** Layer 1 (Keycloak): JWT token is validated and roles are extracted via `KeycloakAuthGuard` (from Epic 1 spike, now production-ready)
**And** Layer 2 (NestJS Guards): `RolesGuard` with `@Roles('admin_tenant', 'lider')` decorator checks the user's role. `TenantGuard` verifies the user belongs to the requested tenant
**And** Layer 3 (PostgreSQL RLS): queries are automatically scoped to `tenant_id` via Prisma extension — even if Guards are bypassed, data leakage is impossible

**Given** this story creates 3 Guards
**When** each Guard is implemented
**Then** `KeycloakAuthGuard` validates JWT signature, expiration, and extracts claims (production-hardened from spike)
**And** `RolesGuard` checks `realm_roles` claim against `@Roles()` decorator on the endpoint
**And** `TenantGuard` verifies the user's `tenant_id` matches the requested resource's tenant
**And** `GroupGuard` is NOT created in this story — deferred to Epic 4 (Grupos)

**Given** the 4 roles are defined: `super_admin`, `admin_tenant`, `lider`, `participante`
**When** each role accesses the API
**Then** `super_admin` can access all tenants and platform management endpoints
**And** `admin_tenant` can access only their tenant's management endpoints
**And** `lider` can access only their assigned groups within the tenant
**And** `participante` can access only their own data and group content

**Given** a user with role `participante` attempts to access an admin endpoint
**When** the NestJS Guard evaluates the request
**Then** the request is rejected with HTTP 403 and error `{ statusCode: 403, error: "Forbidden", message: "Insufficient permissions" }`
**And** no stack trace is exposed to the frontend
**And** the rejection is logged (Pino: `action: "auth.access.denied"`, `user_id`, `endpoint`, `required_role`)

### Story 2.5: Seleção de Tenant Ativo e Associação Multi-tenant

As a user associated with multiple tenants,
I want to select which tenant I'm working in,
So that I see only data relevant to my current context.

**Acceptance Criteria:**

**Given** I am logged in and associated with 2+ tenants (FR03)
**When** I access the platform
**Then** I see a tenant selection screen listing all my tenants with their name, my role in each, and plan status
**And** I can select one tenant to set as active

**Given** I select a tenant
**When** the selection is confirmed
**Then** the `tenant_id` is set in my JWT/session context
**And** all subsequent API requests include `tenant_id` via RequestContext (AsyncLocalStorage)
**And** the Prisma tenant extension auto-filters all queries to the active tenant
**And** the `TenantGuard` from Story 2.4 validates my access to this tenant
**And** I am redirected to the app dashboard for that tenant

**Given** I am associated with only 1 tenant
**When** I login
**Then** that tenant is automatically selected and I skip the selection screen

**Given** I want to switch tenants during a session
**When** I access the tenant switcher
**Then** I can select a different tenant and the context switches immediately
**And** the previous tenant's data is no longer accessible in the UI

**Given** one of my tenants has an expired plan
**When** I see the tenant selection screen
**Then** the expired tenant is shown with a visual indicator (e.g., "Plano expirado") and is still selectable
**And** upon selecting an expired tenant, I see a limited view with an upgrade prompt (detailed behavior in Epic 11)

### Story 2.6: Isolamento de Dados por Tenant (RLS)

As a platform operator,
I want complete data isolation between tenants enforced at the database level,
So that no data from one tenant is ever accessible by another tenant (FR07, NFR-S10).

**Acceptance Criteria:**

**Given** RLS policies are applied to all existing tables with `tenant_id` (`users`, `user_tenants`, `consents`)
**When** a query is executed via Prisma
**Then** the Prisma tenant extension automatically injects `WHERE tenant_id = :current_tenant` on all operations (SELECT, INSERT, UPDATE, DELETE)
**And** `tenant_id` is NEVER passed as a function parameter — always from AsyncLocalStorage via RequestContext

**Given** the RLS test suite runs
**When** tests execute with 2 provisioned test tenants
**Then** Tenant A cannot SELECT, UPDATE, or DELETE records belonging to Tenant B
**And** INSERT operations for Tenant A automatically set `tenant_id` to Tenant A's ID
**And** JOINs between tables (e.g., users ↔ user_tenants) respect RLS boundaries
**And** Subqueries and aggregations (e.g., COUNT of users per tenant) respect RLS
**And** the test suite runs on every PR in the CI pipeline

**Given** a new migration is created in a future epic that adds a table
**When** the migration is applied
**Then** the table MUST include `tenant_id` column
**And** an RLS policy MUST be created for the table
**And** the CI fails if RLS test coverage doesn't include the new table
**And** the RLS test framework is extensible to cover views and materialized views when created in future epics

### Story 2.7: Gestão de Usuários e Papéis pelo Admin Tenant

As an Admin Tenant,
I want to manage users and their roles within my tenant,
So that I can control who has access and what they can do (FR08).

**Acceptance Criteria:**

**Given** I am logged in as Admin Tenant
**When** I access the user management page
**Then** I see a list of all users in my tenant with their name, email, role, and status
**And** the list is scoped to my tenant only (RLS enforced)

**Given** I want to change a user's role
**When** I select a user and assign a new role (e.g., `participante` → `lider`)
**Then** the role is updated in both Keycloak and PostgreSQL
**And** the change is logged in the audit trail (Pino: `action: "auth.role.changed"`, `target_user_id`, `old_role`, `new_role`)
**And** the user's JWT is invalidated and they must re-authenticate to get updated claims

**Given** I want to remove a user from my tenant
**When** I remove the user
**Then** the user's association with this tenant is removed
**And** all active sessions and tokens for this user in this tenant are revoked (FR11)
**And** the removal is logged in the audit trail
**And** the user can still access other tenants they belong to (FR03)

**Given** I remove a user and the user attempts to use their old token
**When** the old token is sent in an API request
**Then** the request is rejected with HTTP 401 Unauthorized
**And** the rejection is logged (Pino: `action: "auth.token.revoked"`, `user_id`, `tenant_id`)

**Given** I attempt to manage users from another tenant
**When** the request reaches the API
**Then** it is rejected by RLS — no data from other tenants is visible

### Story 2.8: Consentimento LGPD e Termos de Uso (Middleware)

As a new user,
I want to review and accept the privacy policy and terms of use on my first access,
So that the platform collects my data with my explicit consent as required by LGPD (FR72, FR75, NFR-L3).

**Acceptance Criteria:**

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

