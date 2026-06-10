# Data Model: 2-4-tenant-guard

**Feature**: `2-4-tenant-guard` | **Date**: 2026-06-09

> This feature introduces no new database tables or migrations. All entities are
> TypeScript-level constructs (enum, interface, log shape).

---

## Entity: Role (enum)

**Location**: `apps/api/src/auth/enums/role.enum.ts`
**Type**: TypeScript const enum

| Value | String literal | Description |
|-------|---------------|-------------|
| `Role.SUPER_ADMIN` | `'super_admin'` | Platform operator; bypasses tenant check; accesses all tenants |
| `Role.ADMIN_TENANT` | `'admin_tenant'` | Church admin; scoped to their single tenant |
| `Role.LIDER` | `'lider'` | Group leader; scoped to their tenant and assigned groups |
| `Role.PARTICIPANTE` | `'participante'` | Church member; access to own data and group content |

**Notes**:
- Values match Keycloak `realm_roles` claim strings exactly (case-sensitive).
- The `@Roles()` decorator accepts `Role | string` for backward compatibility with legacy `'pastor'`/`'admin'` callsites (see research.md Decision 2).
- The `AuthenticatedUser.roles` field type changes from `string[]` to `(Role | string)[]` — no breaking change.

---

## Entity: AuthenticatedUser (interface update)

**Location**: `apps/api/src/auth/interfaces/authenticated-user.interface.ts`
**Type**: TypeScript interface (existing, updated)

| Field | Before | After | Notes |
|-------|--------|-------|-------|
| `userId` | `string` | `string` | No change |
| `tenantId` | `string` | `string` | No change |
| `roles` | `string[]` | `(Role \| string)[]` | Widened for backward compat |
| `email` | `string` | `string` | No change |

---

## Entity: AuthRejectionLog (log shape)

**Location**: emitted by `RolesGuard` and `TenantGuard` via `Logger` (structured Pino)
**Type**: Runtime log record (not persisted to DB)

| Field | Type | Present in | Notes |
|-------|------|-----------|-------|
| `action` | `"auth.access.denied"` | Both guards | Always present |
| `user_id` | `string` | Both guards | `"unknown"` if unavailable |
| `endpoint` | `string` | Both guards | `"METHOD /path"` format |
| `required_role` | `string \| string[]` | RolesGuard only | From `@Roles()` metadata |
| `actual_roles` | `string[]` | RolesGuard only | From `user.roles` |
| `tenant_mismatch` | `boolean` | TenantGuard only | Always `true` when logged |

**Security constraints**:
- No JWT content, no request body, no email in log entry.
- **Tenant UUIDs MUST NOT appear in TenantGuard log entries** — logging `expected_tenant`/`actual_tenant` UUIDs would allow cross-tenant UUID discovery via log access (IDOR via log leakage, OWASP API1). Use boolean `tenant_mismatch: true` instead.

---

## Entity: TenantGuard (NestJS guard)

**Location**: `apps/api/src/auth/guards/tenant.guard.ts`
**Type**: NestJS `CanActivate` implementation

**Dependencies** (all existing, no new deps):
- `requestContext` from `apps/api/src/common/context/request-context.ts` (AsyncLocalStorage)
- `AuthenticatedUser` from `apps/api/src/auth/interfaces/authenticated-user.interface.ts`
- `Role` enum from `apps/api/src/auth/enums/role.enum.ts` (new, same feature)
- `IS_PUBLIC_KEY` from `apps/api/src/auth/decorators/public.decorator.ts`
- NestJS `Reflector`, `Logger`, `ForbiddenException`

**State transitions** (per request):
```
Request arrives
  → IS_PUBLIC? → bypass (true)
  → user not set? → ForbiddenException (403)
  → user.roles includes SUPER_ADMIN? → bypass (true)
  → user.tenantId == requestContext.tenantId? → pass (true) / ForbiddenException (403)
```
