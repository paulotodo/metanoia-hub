# Quickstart & Test Scenarios: Tenant Selection Residual

## Scenario 1 — Single-tenant user bypasses selection screen (happy path)

1. User authenticates; Keycloak issues JWT with `tenant_id = T1`.
2. User lands on `/selecionar-igreja`.
3. `useMyTenants` resolves `[{ tenantId: T1, ... }]` (length === 1).
4. Auto-select `useEffect` fires once (guarded by `hasFired` ref):
   - Shows loading indicator.
   - Calls `POST /api/v1/tenants/select` with `{ tenantId: T1 }`.
5. On success: `setActiveTenantId(T1)` + `router.push('/app/gestao')`.
6. **Expected**: user never sees the church list; lands on `/app/gestao`.

---

## Scenario 2 — Multi-tenant user sees selection screen (no auto-select)

1. `useMyTenants` resolves `[T1, T2]` (length > 1).
2. Auto-select `useEffect` does NOT fire.
3. **Expected**: normal `ChurchCard` list is displayed.

---

## Scenario 3 — Auto-select API call fails, shows fallback UI

1. `useMyTenants` resolves `[T1]`.
2. Auto-select fires; `POST /api/v1/tenants/select` returns 503.
3. `onError` callback fires: `hasFired` remains true (no retry loop).
4. **Expected**: selection screen renders (empty list or error state).
   No redirect loop, no infinite spinner.

---

## Scenario 4 — Redis unavailable on GET request (fallback to JWT)

1. Redis is down. User sends a request with valid JWT (`tenant_id = T1`).
2. `KeycloakAuthGuard.resolveActiveTenant` catches the Redis exception.
3. **Expected**:
   - Guard returns `T1` (JWT fallback).
   - `this.logger.error(...)` is called with message including `userId` and the error.
   - Request proceeds normally with `T1` as the active tenant.

---

## Scenario 5 — Redis unavailable on POST /select-tenant

1. User submits `POST /api/v1/tenants/select { tenantId: T2 }`.
2. Membership check passes (DB query OK).
3. `this.redis.set(...)` throws a connection error.
4. **Expected**:
   - Response: `HTTP 503 { statusCode: 503, error: "Service Unavailable", message: "..." }`.
   - No silent partial update.
   - Frontend can display retry prompt.

---

## Roundtrip end-to-end (backend↔frontend contract)

1. Start API with Redis mocked to return `null` for `user:*:active-tenant`.
2. GET `/api/v1/tenants/my-tenants` with valid JWT.
3. Parse response body.
4. **Expected**: shape matches `MyTenantsResponseSchema` (Zod parse must pass).
5. POST `/api/v1/tenants/select` with the first tenantId from step 3.
6. **Expected**: shape matches `SelectTenantResponseSchema` (Zod parse must pass).
