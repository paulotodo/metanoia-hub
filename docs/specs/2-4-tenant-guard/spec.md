# Feature Spec: 2-4-tenant-guard

**Short Name**: 2-4-tenant-guard
**Status**: Draft
**Created**: 2026-06-09
**Pipeline**: specify → clarify → plan → checklist → create-tasks → execute-task → review-task

> Decisões de infraestrutura: N/A — feature stateless (autorização request-scoped, sem scheduling ou dados persistentes próprios).

---

## Context

The platform's 3-layer authorization is partially implemented. Layer 1 (JWT validation via Keycloak) and Layer 2 (role checking via `RolesGuard`) already exist and must not be modified. This spec covers only the **residual gap**: Layer 3 tenant isolation guard, a formal Role enum to replace inline strings, structured rejection logging, and integration tests that validate all three layers together.

---

## User Scenarios & Testing

### P1 — Tenant Isolation Enforcement

**As** a platform operator,
**I want** API requests to be rejected when a user attempts to access a resource belonging to a different tenant,
**So that** tenant data remains isolated even if the RLS layer is bypassed or misconfigured.

**Acceptance Scenarios**:
- An `admin_tenant` user whose token identifies tenant A receives 403 when requesting a resource scoped to tenant B.
- A `super_admin` user can access resources scoped to any tenant without rejection.
- A `lider` user can access resources within their own tenant and is rejected for other tenants.
- The 403 response body follows the standardized error format: `{ statusCode: 403, error: "Forbidden", message: "Tenant access denied" }`.
- No stack trace appears in the 403 response.

**Edge Cases**:
- Request arrives with no tenant context in the resolved user object → reject with 403 (not 500).
- `super_admin` role must bypass tenant check even if `tenantId` on user does not match the resource tenant.

---

### P2 — Formal Role Enum Replaces Inline Strings

**As** a developer maintaining the authorization layer,
**I want** roles to be defined as a typed enum rather than free-form strings,
**So that** typos in role names are caught at compile time and role references are centralized.

**Acceptance Scenarios**:
- A single `Role` enum defines all four platform roles: `super_admin`, `admin_tenant`, `lider`, `participante`.
- The `@Roles()` decorator accepts `Role` enum values (not raw strings).
- The `RolesGuard` compares user roles against `Role` enum values.
- All existing callsites of `@Roles('admin_tenant')`, `@Roles('lider')`, etc. are updated to use the enum.
- TypeScript compilation fails if an undefined role string is passed to `@Roles()`.

**Edge Cases**:
- Existing tests for `RolesGuard` continue to pass after the refactor.
- The `AuthenticatedUser` interface's `roles` field is compatible with the enum type.

---

### P3 — Structured Rejection Logging

**As** a security operator,
**I want** every authorization rejection to emit a structured log entry,
**So that** access-denied events can be monitored, audited, and alerted on.

**Acceptance Scenarios**:
- When `RolesGuard` rejects a request, a log entry with `action: "auth.access.denied"`, `user_id`, `endpoint`, and `required_role` fields is emitted.
- When `TenantGuard` rejects a request, the same log structure is emitted with `action: "auth.access.denied"`, `user_id`, `endpoint`, and `tenantId` fields.
- Log entries are structured JSON (Pino format), not plain text.
- Log entries do not include sensitive data (no JWT, no full request body).

**Edge Cases**:
- If `user_id` is unavailable at log time, the entry uses a placeholder (`"unknown"`) rather than omitting the field or throwing.

---

### P4 — Integration Tests: Three-Layer Authorization

**As** a QA engineer,
**I want** automated tests that exercise all three authorization layers together,
**So that** regressions in any layer are caught before deployment.

**Acceptance Scenarios**:
- Test: `super_admin` token successfully accesses an endpoint protected with `@UseGuards(KeycloakAuthGuard, RolesGuard, TenantGuard)` for any tenant value.
- Test: `admin_tenant` token for tenant A receives 403 when accessing an endpoint scoped to tenant B.
- Test: `participante` token receives 403 when accessing an endpoint requiring `admin_tenant` role.
- Test: valid token for tenant A is accepted when the resource belongs to tenant A.
- Tests are co-located (`*.spec.ts`) and include a `tenantId` in all test factories.

**Edge Cases**:
- Test covers the case where `tenantId` is present in the user object but mismatches the resource tenant.
- Test verifies the 403 response body conforms to `{ statusCode, error, message }` without stack trace.

---

## Requirements

### Functional Requirements

**FR-01 — TenantGuard**
The system MUST provide a `TenantGuard` that:
- Reads the resolved `tenantId` from the authenticated user object (populated by `KeycloakAuthGuard`).
- Reads the resource's `tenant_id` from `AsyncLocalStorage`/`RequestContext` — never from function parameters.
- Rejects the request with HTTP 403 and the standardized error body when the two values do not match.
- Automatically bypasses the tenant check for users holding the `super_admin` role.
- **MUST fail-closed**: if `RequestContext` is unavailable (store is `null`/`undefined`), reject with 403 — NEVER pass the request. Missing context indicates a middleware misconfiguration and MUST be treated as a security failure, not a pass-through.

**FR-02 — Role Enum**
The system MUST define a `Role` enum containing exactly four values: `super_admin`, `admin_tenant`, `lider`, `participante`. All existing references to role strings in `@Roles()`, `RolesGuard`, and related interfaces MUST be migrated to use this enum.

**FR-03 — Pino Rejection Logging**
Both `RolesGuard` and `TenantGuard` MUST emit a structured Pino log entry on every rejection. The entry MUST include:
- `action: "auth.access.denied"`
- `user_id` (string; `"unknown"` if unavailable)
- `endpoint` (HTTP method + path)
- `required_role` (for `RolesGuard`) — the role(s) required by the endpoint
- `tenant_mismatch: true` (for `TenantGuard`) — boolean flag, NEVER the raw tenant UUIDs

No sensitive data (JWT content, request body) may appear in the log entry. Tenant UUIDs MUST NOT appear in the log entry for `TenantGuard` rejections — logging them would expose cross-tenant UUID discovery to any operator with log access (IDOR via log leakage). Use the boolean `tenant_mismatch: true` field instead.

**FR-04 — Standardized 403 Response**
Every authorization rejection MUST return HTTP 403 with body `{ statusCode: 403, error: "Forbidden", message: "<human-readable reason>" }`. No stack trace included.

**FR-05 — Integration Test Coverage**
Integration tests MUST cover the following scenarios: (a) `super_admin` bypasses tenant check; (b) `admin_tenant` blocked on cross-tenant access; (c) `participante`/`lider` blocked on insufficient role; (d) valid same-tenant access succeeds. All test factories include `tenantId`.

**FR-06 — Backward Compatibility**
The `RolesGuard` refactor MUST NOT break existing behavior. Endpoints that currently work MUST continue to work after the Role enum migration.

---

### Key Entities

**Role (enum)**
Values: `super_admin`, `admin_tenant`, `lider`, `participante`.
Used in: `@Roles()` decorator, `RolesGuard`, `TenantGuard` bypass logic, `AuthenticatedUser.roles` type.

**TenantGuard**
NestJS `CanActivate` guard that enforces per-request tenant isolation. Depends on `RequestContext` (AsyncLocalStorage) and the `AuthenticatedUser` populated by `KeycloakAuthGuard`.

**AuthRejectionLog**
Structured log record emitted on every guard rejection. Fields: `action`, `user_id`, `endpoint`, `required_role` (optional), `expected_tenant` (optional), `actual_tenant` (optional).

---

## Success Criteria

1. A user with `admin_tenant` role for tenant A cannot access any resource of tenant B — verified by integration test with 403 assertion.
2. A user with `super_admin` role successfully accesses resources of all tenants — verified by integration test.
3. TypeScript compilation catches any use of an undefined role string passed to `@Roles()` — verified by the type system.
4. Every authorization rejection produces a structured log entry with all required fields — verified by unit test asserting logger call arguments.
5. No authorization rejection returns a stack trace to the caller — verified by response body assertion in tests.
6. All existing authorization-related unit tests continue to pass after the Role enum migration.
7. CI (lint + test + build) is green after implementation.

---

## Out of Scope

- `GroupGuard` (deferred to Epic 4 — Grupos).
- `KeycloakAuthGuard` modifications — Layer 1 is production-ready and must not be changed.
- Keycloak realm configuration changes.
- LGPD/audit trail storage for rejected requests (handled by the audit bounded context).
- Frontend error handling for 403 responses (existing error boundaries cover this).
