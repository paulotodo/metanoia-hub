# Data Model: Tenant Selection Residual (Story 2-5)

## No Schema Changes

This story introduces **no new database tables, columns, or migrations**.

All persistence is in Redis (existing key `user:{userId}:active-tenant`)
and the existing `user_tenants` table (read-only in this story).

---

## Existing Redis Key (reference)

| Key pattern | Type | TTL | Set by | Read by |
|-------------|------|-----|--------|---------|
| `user:{userId}:active-tenant` | string (UUID) | `ACTIVE_TENANT_TTL_SECONDS` = 30 days | `TenantSelectionService.selectTenant` | `KeycloakAuthGuard.resolveActiveTenant` |

### State transitions

```
[no cache entry]
      │
      │  POST /api/v1/tenants/select
      ▼
[cache entry: tenantId]   ──────────── Redis unavailable ──────────▶ [fallback: JWT tenant_id]
      │                                                                       │
      │  TTL expires / user switches                                          │ (error-level log)
      ▼                                                                       │
[no cache entry]  ◀──────────────────────────────────────────────────────────┘
```

### Resilience policy (FR-005, FR-008)

**JWT is the authoritative fallback.** When `user:{userId}:active-tenant`
cannot be read from Redis (connection error, timeout, or key absent), the
guard resolves the tenant from the JWT `tenant_id` claim. This is safe because:

1. The JWT is cryptographically signed and cannot be tampered.
2. `tenant_id` in the JWT is the user's primary (onboarding) tenant.
3. The only data quality risk is a recently-switched user reverting to their
   primary tenant for the duration of the Redis outage — acceptable and logged.

**Condition for error-level log**: Redis throws an exception (not: key absent).
Key-absent is silent (normal operation, no selection made yet).

**Condition for 503 on selectTenant**: Redis throws during the `SET` call.
The frontend must surface a retryable error message.
