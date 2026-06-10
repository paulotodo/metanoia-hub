# Research: Tenant Selection Residual (Story 2-5)

## Decision 1 — Redis fallback log level: `warn` vs `error`

**Decision**: Upgrade the Redis fallback log call in `KeycloakAuthGuard.resolveActiveTenant`
from `this.logger.warn(...)` to `this.logger.error(...)`.

**Rationale**: FR-005 states the system MUST emit an **error-level** diagnostic
entry when falling back to the JWT-embedded tenant due to cache unavailability.
The current code uses `warn`, which on-call operators may filter out. Error-level
is the correct severity because the cache is a critical operational component
and its absence degrades tenant-resolution correctness for recently-switched users.

**Alternatives considered**:
- Keep `warn` and add a metric counter — rejected; metrics require additional
  tooling not yet in scope; log level change is zero-infrastructure.
- Use a custom NestJS event — rejected; over-engineering for the observable goal.

---

## Decision 2 — Auto-select placement: `useEffect` in `ChurchSelectClient`

**Decision**: Implement auto-select as a `useEffect` inside the existing
`ChurchSelectClient` component, guarded by a `hasFired` ref to prevent duplicate
mutations.

**Rationale**: The component already owns the `useMyTenants` query and
`useSelectTenant` mutation. Adding auto-select here avoids introducing a new
route or Server Component, which would not have access to the client-side
session context needed to call `selectTenant`. The `hasFired` ref (not state)
prevents re-triggering on re-renders without causing its own render cycle.

**Alternatives considered**:
- Implement in the Server Component (`page.tsx`) via a redirect: rejected because
  the tenant list is behind an authenticated API call that is not available in RSC
  without a round-trip; adds latency and complicates error fallback.
- Introduce a separate route `/auto-redirect`: rejected; unnecessary routing layer
  for a one-liner conditional.

---

## Decision 3 — Redis resilience on `selectTenant`: explicit failure when cache write fails

**Decision**: Modify `TenantSelectionService.selectTenant` to propagate a
`ServiceUnavailableException` (HTTP 503) when the Redis write throws, rather
than logging and proceeding.

**Rationale**: FR-007 requires the operation to fail explicitly if the cache is
unavailable at selection time, so the frontend can inform the user and prompt a
retry. The current code does not catch Redis errors in `selectTenant`, so an
unhandled exception already bubbles up as a 500 — upgrading to an explicit 503
gives the frontend a stable, retryable status code and documents the policy.

**Alternatives considered**:
- Silently succeed and accept stale cache: rejected; violates FR-007 and SC-002.
- Write to both cache and DB as fallback: rejected; over-engineering, the DB is
  not the source of truth for active-tenant override.

---

## Decision 4 — No new Zod schemas needed

**Decision**: All required Zod schemas already exist in `packages/types/src/auth/tenant-selection.ts`.
No new types are added by this story.

**Rationale**: The auto-select flow reuses `SelectTenantInput` and
`SelectTenantResponse`. The Redis fallback is a backend concern with no
new API surface. No schema changes required.
