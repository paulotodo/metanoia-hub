# Quickstart / Test Scenarios: 2-4-tenant-guard

**Feature**: `2-4-tenant-guard` | **Date**: 2026-06-09

---

## Scenario 1 — admin_tenant blocked on cross-tenant access (happy path of guard)

1. Create test user with `roles: [Role.ADMIN_TENANT]`, `tenantId: 'tenant-A'`
2. Populate `requestContext` with `tenantId: 'tenant-B'` (simulating resource from another tenant)
3. Call `TenantGuard.canActivate(mockExecutionContext)`
4. **Expected**: throws `ForbiddenException` with message `"Tenant access denied"`
5. **Expected log**: `{ action: "auth.access.denied", user_id: "...", endpoint: "GET /some-path", expected_tenant: "tenant-B", actual_tenant: "tenant-A" }`

---

## Scenario 2 — super_admin bypasses tenant check

1. Create test user with `roles: [Role.SUPER_ADMIN]`, `tenantId: 'tenant-A'`
2. Populate `requestContext` with `tenantId: 'tenant-B'`
3. Call `TenantGuard.canActivate(mockExecutionContext)`
4. **Expected**: returns `true` (no exception)
5. **Expected log**: none

---

## Scenario 3 — same-tenant access succeeds

1. Create test user with `roles: [Role.LIDER]`, `tenantId: 'tenant-A'`
2. Populate `requestContext` with `tenantId: 'tenant-A'`
3. Call `TenantGuard.canActivate(mockExecutionContext)`
4. **Expected**: returns `true` (no exception)

---

## Scenario 4 — participante blocked by RolesGuard (role check layer)

1. Create test user with `roles: [Role.PARTICIPANTE]`
2. Decorate endpoint with `@Roles(Role.ADMIN_TENANT)`
3. Call guard chain: `RolesGuard.canActivate(mockExecutionContext)`
4. **Expected**: throws `ForbiddenException`
5. **Expected log**: `{ action: "auth.access.denied", user_id: "...", required_role: ["admin_tenant"], actual_roles: ["participante"] }`

---

## Scenario 5 — Three-layer guard chain (integration)

1. Create NestJS test module with `APP_GUARD` providers: `KeycloakAuthGuard`, `RolesGuard`, `TenantGuard`
2. Create controller endpoint decorated with `@UseGuards(...)` + `@Roles(Role.ADMIN_TENANT)`
3. Simulate request: valid JWT for `admin_tenant` user on `tenant-A`, endpoint context is `tenant-A`
4. **Expected**: controller handler invoked (200)
5. Simulate cross-tenant: same JWT, endpoint context is `tenant-B`
6. **Expected**: `TenantGuard` rejects with 403

---

## Scenario 6 — user_id unavailable at log time (edge case)

1. Create user object with `userId: ''` or `undefined`
2. `TenantGuard` rejects the request
3. **Expected log**: `{ user_id: "unknown", ... }` — no field omission, no exception thrown

---

## Scenario 7 — Role enum type safety (compile-time)

```typescript
// This should compile:
@Roles(Role.ADMIN_TENANT, Role.LIDER)

// This should produce a TypeScript error:
@Roles('undefined_role_xyz')  // NOT in enum — TS error if decorator is strictly typed
```
> Note: TypeScript strictness depends on `@Roles` signature; see research.md Decision 2 for hybrid `Role | string` approach.

---

## Scenario 8 — 403 response body format

1. Any guard rejection
2. **Expected response body**: `{ statusCode: 403, error: "Forbidden", message: "<reason>" }`
3. **Must NOT contain**: `stack`, `trace`, `at Object.`, or any internal path

---

## Scenario 9 — TenantGuard fail-closed when RequestContext unavailable (security critical)

1. Create execution context where `requestContext.getStore()` returns `undefined` (middleware not registered or bypassed)
2. Call `TenantGuard.canActivate(mockExecutionContext)`
3. **Expected**: throws `ForbiddenException` (403) — guard MUST NOT return `true`
4. **Security rationale**: missing context = middleware misconfiguration; fail-open here bypasses all tenant isolation
5. **Expected log**: `{ action: "auth.access.denied", user_id: "unknown", endpoint: "...", tenant_mismatch: true }`
