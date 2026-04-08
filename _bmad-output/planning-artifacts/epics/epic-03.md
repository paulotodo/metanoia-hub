## Epic 3: Provisionamento de Tenant & Configuração Básica

Super Admin provisiona tenants com dados mínimos de forma transacional. Metadata registrada. Gestão de tenants pela plataforma. Limites básicos hardcoded por plano implementados como guard.

### Story 3.1: Provisionamento Transacional de Tenant

As a Super Admin,
I want to provision a new tenant with minimal required data in a transactional flow,
So that tenant creation is atomic and no orphan records exist if any step fails.

**Acceptance Criteria:**

**Given** I am authenticated as Super Admin
**When** I submit the tenant provisioning form with name, slug, admin email and selected plan (Free/Pro/Enterprise)
**Then** the system creates the tenant record, Keycloak realm, and admin user in a single transaction
**And** the flow uses saga pattern (não 2PC): criar tenant no banco → criar realm Keycloak → se Keycloak falhar, marcar tenant com `status: provisioning_failed` para retry manual pelo Super Admin (botão na UI)
**And** the `tenants` table includes: `id` (UUID v7), `name`, `slug` (unique, URL-safe: `^[a-z0-9-]+$`), `status` (enum `TenantStatus`: `active`, `provisioning_failed`, `suspended`), `plan` (enum `TenantPlan`: `free`, `pro`, `enterprise`), `plan_limits_override` (JSONB, nullable), `metadata` (JSONB), `created_at`, `updated_at`
**And** slug validation rejects values that não match `^[a-z0-9-]+$` with 422 and descriptive error
**And** RLS policies are applied to the tenants table from creation
**And** the API returns 201 with the created tenant data

**Given** a tenant with `status: provisioning_failed` exists
**When** I trigger a retry for that tenant
**Then** the system retries the failed Keycloak step and updates status to `active` on success

**Given** I try to create a tenant with a slug that already exists
**When** I submit the provisioning form
**Then** the API returns 409 Conflict with a clear error message

### Story 3.2: Gestão de Tenants pelo Super Admin

As a Super Admin,
I want to list, view details, and update tenant information,
So that I can manage all tenants on the platform effectively.

**Acceptance Criteria:**

**Given** I am authenticated as Super Admin
**When** I access the tenant management area
**Then** I see a paginated list of all tenants with name, slug, plan, status and creation date
**And** I can filter by status (active/suspended/provisioning_failed), by plan (free/pro/enterprise), and search by name or slug
**And** the Super Admin bypasses RLS via `PrismaAdminService` (connection pool separado sem RLS, isolado do `PrismaService` padrão) — decisão documentada em ADR

**Given** I am viewing the tenant list
**When** I click on a specific tenant
**Then** I see the tenant detail page with all metadata (FR19): name, slug, plan, status, admin contact, member count, creation date
**And** I can edit tenant name, metadata, and status (activate/suspend)

**Given** I update a tenant's status to `suspended`
**When** users of that tenant try to access the system
**Then** they receive a clear message that their organization's access is suspended
**And** sessões ativas do tenant no Keycloak são invalidadas (logout forçado) no momento da suspensão
**And** an audit log entry is created for the status change

**Given** I am on the tenant detail page
**When** I update metadata fields
**Then** the changes are persisted and the `updated_at` timestamp is refreshed
**And** the API returns 200 with the updated tenant data

### Story 3.3: Guard de Limites por Plano (Hardcoded)

As a platform operator,
I want hardcoded plan limits enforced via a NestJS Guard,
So that tenants cannot exceed their plan's resource allocation before dynamic configuration exists.

**Acceptance Criteria:**

**Given** the system has hardcoded plan limits defined as constants:
- Free: max 3 groups, 15 members/group
- Pro: max 10 groups, 50 members/group
- Enterprise: max 50 groups, 200 members/group
**When** any resource creation request is received
**Then** a NestJS Guard (not middleware) checks the tenant's current resource count against the plan limit
**And** if the `plan_limits_override` field (from Story 3.1) is set, those values take precedence over hardcoded defaults

**Given** a tenant on the Free plan already has 3 groups
**When** a request to create a 4th group is made
**Then** the Guard returns 403 with message indicating the plan limit was reached
**And** the response includes current count, limit, and a hint about upgrading

**Given** concurrent requests attempt to create resources that would exceed the limit
**When** both requests are processed simultaneously
**Then** atomic limit enforcement via Redis `INCR` atômico ensures only one succeeds (race condition test required)
**And** the resource count is cached in Redis (`cache:tenant:{id}:resource_count`) with TTL de 5 minutos e invalidação eager on create/delete
**And** if Redis is unavailable, fallback para `SELECT COUNT` com lock pessimista no PostgreSQL (garantindo consistência mesmo sem cache)

**Given** the Guard is implemented
**When** integration tests run
**Then** tests include a simulated group creation scenario (preparation for Epic 4)
**And** tests verify Guard blocks creation at exact boundary (e.g., 3rd group OK, 4th blocked for Free plan)
**And** tests verify `plan_limits_override` correctly overrides hardcoded defaults

