# Feature Specification: Tenant Selection — Residual (Story 2-5)

**Feature**: `2-5-tenant-select-residual`
**Created**: 2026-06-09
**Status**: Draft

## Context

This spec covers **only the residual scope** of Story 2-5, after reconciliation
with the WDS cenário 08 delivery (PRs #69–#71). Approximately 70% of Story 2-5
is already live. This feature closes the remaining 30%:

1. **Auto-select** for single-tenant users (AC#8–9)
2. **Explicit Redis fallback behavior** for the JWT↔Redis resilience gap (AC#4)

Deferred to Epic 11: expired plan visual indicator and limited view (AC#13–15).

---

## User Scenarios & Testing

### User Story 1 — Single-Tenant Auto-Select (Priority: P1)

A user associated with exactly one church/tenant should land directly on their
dashboard after login, without passing through the church-selection screen. The
extra step adds friction and conveys a false sense of choice that does not exist
for this user profile.

**Why this priority**: This is the most common onboarding profile — a member
who belongs to a single congregation. Every unnecessary screen reduces activation.

**Independent Test**: Log in with an account that has exactly one tenant
membership. The selection screen must never appear; the user must arrive at the
main dashboard.

**Acceptance Scenarios**:

1. **Given** I am authenticated and my account is associated with exactly 1 tenant,
   **When** I land on `/selecionar-igreja`,
   **Then** that tenant is selected automatically, my session context is updated to
   that tenant, and I am redirected to the dashboard — with no visible selection UI.

2. **Given** the single-tenant auto-select is in progress,
   **When** the tenant-selection API call is in flight,
   **Then** a loading/redirect indicator is shown so the user is not left on a blank screen.

3. **Given** I am authenticated and my account is associated with 2+ tenants,
   **When** I land on `/selecionar-igreja`,
   **Then** the normal church-selection list is displayed (no auto-select occurs).

4. **Given** the single-tenant auto-select is attempted,
   **When** the tenant-selection API call fails,
   **Then** the selection screen is shown as a fallback (no silent failure or redirect loop).

---

### User Story 2 — Redis Resilience and Explicit Fallback (Priority: P2)

When a user selects a tenant, the active tenant is stored in a fast cache layer.
If that cache layer is temporarily unavailable, the system should gracefully fall
back to the tenant embedded in the user's authentication token, with a visible
signal for operators to detect and investigate the degraded state.

**Why this priority**: Without this, a Redis outage causes silent wrong-tenant
context for users who recently switched tenants, which breaks multi-tenancy
correctness. The fallback already exists in code; this story makes it explicit,
logged at the right severity, and test-covered.

**Independent Test**: Simulate a cache failure scenario. Confirm that the
user's session continues with the JWT-embedded tenant as fallback, and that
an error-level entry appears in the application log.

**Acceptance Scenarios**:

1. **Given** a user has selected a tenant and that selection is persisted in cache,
   **When** the cache layer is available on subsequent requests,
   **Then** the selected tenant is resolved correctly and the user sees only data
   for their chosen tenant.

2. **Given** a user has selected a tenant,
   **When** the cache layer becomes unavailable on a subsequent request,
   **Then** the system falls back to the tenant in the authentication token,
   **And** an error-level log entry is emitted indicating the cache failure and
   the fallback used, so on-call operators are alerted.

3. **Given** a user has not yet selected a tenant after login (no cache entry),
   **When** any authenticated request arrives,
   **Then** the tenant from the authentication token is used (no error logged —
   this is normal operation, not a degradation).

4. **Given** cache is unavailable when a user attempts to select a new tenant,
   **When** the POST /select-tenant request is made,
   **Then** the operation fails with a clear error so the frontend can inform
   the user and prompt a retry, rather than silently proceeding with stale data.

---

### Edge Cases

- What happens if a user's single tenant is removed between JWT issuance and the
  auto-select API call? → The select-tenant endpoint validates membership; a
  not-found response is returned and the user is shown the selection screen
  (which will show zero entries with an appropriate empty state).
- What happens if the cache write succeeds but the response is lost (network
  timeout)? → The cache state is consistent; the next request resolves the
  correct tenant. No retry-idempotency issue because the cache key is
  deterministic (`user:{userId}:active-tenant`).
- What happens during auto-select if the tenants list request and the
  select-tenant mutation race? → The auto-select effect must be guarded by a
  `hasFired` flag or `useEffect` dependency to prevent multiple simultaneous
  mutations.

---

## Requirements

### Functional Requirements

- **FR-001**: When an authenticated user's tenant list resolves to exactly one
  tenant, the system MUST automatically initiate tenant selection without
  requiring explicit user interaction.

- **FR-002**: During automatic tenant selection, a loading state MUST be
  presented to the user to indicate that navigation is in progress.

- **FR-003**: Automatic tenant selection MUST use the same selection endpoint
  and session-context update path as manual selection (no shortcut bypassing
  the canonical flow).

- **FR-004**: If automatic tenant selection fails (API error), the system MUST
  fall back to displaying the manual selection screen — never loop, never
  redirect to an error page.

- **FR-005**: When the cache layer fails to return an active-tenant override,
  the system MUST fall back to the tenant embedded in the authentication token
  and MUST emit an error-level diagnostic entry identifying the affected user
  identity and the fallback in use.

- **FR-006**: The fallback behavior (FR-005) MUST be covered by an automated
  test that simulates cache unavailability and asserts both the correct fallback
  tenant resolution and the error-level log emission.

- **FR-007**: When the cache layer is unavailable at the time of a tenant
  selection request, the selection MUST fail explicitly so the caller can
  communicate the failure to the user, rather than producing a silent partial
  update (cache miss with no error).

- **FR-008**: A design comment co-located with the cache-fallback code MUST
  document the chosen resilience policy (JWT as authoritative fallback), its
  trade-offs, and the conditions under which the fallback is activated.

### Key Entities

- **ActiveTenantContext**: The resolved tenant identifier attached to every
  authenticated request. Sources of truth in priority order: (1) cache override,
  (2) authentication token claim.

> Decisões de infraestrutura: Cache TTL already established (30 days,
> ACTIVE_TENANT_TTL_SECONDS). No new scheduling or key-rotation policy needed.
> Fallback policy is JWT-authoritative (Opção A) — documented in FR-008.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Single-tenant users never see the church-selection screen during
  the standard post-login flow; redirect to dashboard completes within the
  same observable interaction as a manual selection.

- **SC-002**: Zero silent wrong-tenant sessions during a cache-layer outage —
  every request in that window either uses the JWT tenant (logged at error
  level) or fails explicitly with a user-visible error.

- **SC-003**: The cache-fallback path is covered by at least one automated test
  that runs in CI, reducing the probability of regression to near-zero.

- **SC-004**: On-call operators can identify a cache degradation event within
  minutes of occurrence by querying error-level logs — no silent data leakage
  between tenants occurs during the event.

---

## Out of Scope

- Expired plan visual indicator and limited-access view (AC#13–15) — deferred to Epic 11.
- Any changes to the tenant-list endpoint, membership model, or invitation flow.
- Token refresh / forced JWT reissuance — the fallback relies on existing JWT claims,
  no re-auth is required.
