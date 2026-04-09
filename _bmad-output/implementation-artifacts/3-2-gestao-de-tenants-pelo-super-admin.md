# Story 3.2: Gestão de Tenants pelo Super Admin

Status: ready-for-dev

## Story

As a Super Admin,
I want to list, view details, and update tenant information,
So that I can manage all tenants on the platform effectively.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Criar PrismaAdminService (AC: #3)
  - [ ] 1.1 Criar `PrismaAdminService` com connection pool separado sem RLS
  - [ ] 1.2 Isolar do `PrismaService` padrão (que tem RLS)
  - [ ] 1.3 Criar ADR documentando decisão em `docs/decisions/`
  - [ ] 1.4 Restringir uso apenas a módulos super_admin

- [ ] Task 2: API — listar tenants com filtros (AC: #1, #2)
  - [ ] 2.1 Criar `GET /api/v1/admin/tenants` (protegido @Roles('super_admin'))
  - [ ] 2.2 Paginação padrão: `{ data: [...], meta: { total, page, limit } }`
  - [ ] 2.3 Filtros: status, plan
  - [ ] 2.4 Search: name, slug
  - [ ] 2.5 Usar PrismaAdminService (bypass RLS)

- [ ] Task 3: API — detalhes do tenant (AC: #4, #5)
  - [ ] 3.1 Criar `GET /api/v1/admin/tenants/:id`
  - [ ] 3.2 Retornar: name, slug, plan, status, admin contact, member count, created_at
  - [ ] 3.3 Usar PrismaAdminService

- [ ] Task 4: API — editar tenant (AC: #5, #10, #11)
  - [ ] 4.1 Criar `PATCH /api/v1/admin/tenants/:id`
  - [ ] 4.2 Permitir edição: name, metadata, status
  - [ ] 4.3 Atualizar `updated_at`
  - [ ] 4.4 Retornar 200 com tenant atualizado

- [ ] Task 5: Suspensão de tenant (AC: #6, #7, #8, #9)
  - [ ] 5.1 Ao mudar status para `suspended`, invalidar sessões Keycloak
  - [ ] 5.2 Forçar logout de todos users do tenant
  - [ ] 5.3 Mensagem clara para users que tentam acessar
  - [ ] 5.4 Criar audit log entry: `action: "tenant.suspended"`

- [ ] Task 6: Frontend — Gestão de tenants
  - [ ] 6.1 Criar `apps/web/app/(authenticated)/super-admin/tenants/page.tsx` (lista)
  - [ ] 6.2 Criar `apps/web/app/(authenticated)/super-admin/tenants/[id]/page.tsx` (detalhes)
  - [ ] 6.3 Filtros de status e plan
  - [ ] 6.4 Search por nome/slug
  - [ ] 6.5 Formulário de edição
  - [ ] 6.6 Botão de suspensão com confirmação
  - [ ] 6.7 Testes jest-axe

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Prisma v7 (PrismaAdminService sem RLS)
- Keycloak Admin REST API (session invalidation)
- Next.js 16.2 (App Router)
- TanStack Query 5.96.2

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 3.1 (Provisionamento) — tabela tenants existe
- Story 2.4 (Guards) — @Roles('super_admin')
- Story 1.5 (Observabilidade) — Pino audit logging

### Project Structure Notes
```
apps/api/src/prisma/
├── prisma.service.ts           # Standard service with RLS
└── prisma-admin.service.ts     # Admin service WITHOUT RLS (super_admin only)

apps/api/src/admin/
├── admin.module.ts
├── tenants/
│   ├── admin-tenants.controller.ts  # GET /admin/tenants, GET /:id, PATCH /:id
│   └── admin-tenants.service.ts

docs/decisions/
└── adr-prisma-admin-service.md  # ADR for PrismaAdminService

apps/web/app/(authenticated)/super-admin/tenants/
├── page.tsx                    # Tenant list
├── page.spec.tsx
└── [id]/
    ├── page.tsx                # Tenant detail/edit
    └── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-03.md — Story 3.2]
- [Source: docs/project-context.md — FR19, super_admin bypass RLS]
- [Source: _bmad-output/planning-artifacts/architecture.md — PrismaAdminService, tenant management]
