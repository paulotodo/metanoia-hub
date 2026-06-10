# Research: 2-4-tenant-guard

**Feature**: `2-4-tenant-guard` | **Date**: 2026-06-09

## Decision 1 — Role Enum Location

**Decision**: Define `Role` enum in `apps/api/src/auth/enums/role.enum.ts` (API-internal), NOT in `packages/types`.

**Rationale**: The `Role` enum is used exclusively by NestJS guards and decorators — it is not part of the API contract surfaced to the frontend. `packages/types` contains Zod schemas for FE/BE shared contracts; a TypeScript enum for backend guard metadata does not belong there. Pattern confirmed by existing `packages/types/src/auth/tenant-selection.ts` which contains FE-facing schemas only.

**Alternatives considered**:
- `packages/types/src/auth/role.ts` — Rejected: mixes backend-internal guard metadata with shared API contracts; forces frontend to depend on a NestJS-internal concern.
- Inline in `roles.guard.ts` — Rejected: multiple files would need to import from the guard, creating circular dependency risks.

---

## Decision 2 — Roles `'pastor'` and `'admin'` in Existing Callsites

**Decision**: Keep `'pastor'` and `'admin'` as **string literals** in existing `@Roles()` callsites that use them; do NOT add them to the canonical `Role` enum; add them as `Role.LEGACY_PASTOR` and `Role.LEGACY_ADMIN` — REJECTED. Instead, leave those callsites with string literals for now and open a note in research documenting the drift.

**Finding**: 5 controllers use `'pastor'` or `'admin'` roles that are not in the canonical 4-value enum (`super_admin`, `admin_tenant`, `lider`, `participante`):
- `meetings.controller.ts` — `'pastor', 'admin'`
- `meetings/reports/report.controller.ts` — `'pastor', 'admin'`
- `meetings/sse/attendance-live.controller.ts` — `'pastor', 'admin'`
- `meetings/telemetry/focus-heartbeat.controller.ts` — `'pastor', 'admin'`
- `pastoral/pastoral.controller.ts` — `'pastor'`

**Decision**: The `@Roles()` decorator MUST accept both `Role` (enum values) and `string` for backward compatibility during migration. The decorator signature changes from `(...roles: string[])` to `(...roles: (Role | string)[])`. The canonical callsites that use `'admin_tenant'`, `'lider'`, `'super_admin'`, `'participante'` are migrated to `Role.ADMIN_TENANT`, etc. The legacy `'pastor'` and `'admin'` callsites are left as string literals with a `// TODO: migrate to canonical Role enum (Epic 11)` comment. This preserves backward compatibility (FR-06) without breaking existing behavior.

**Rationale**: The spec explicitly says "All existing references to role strings in `@Roles()`, `RolesGuard`, and related interfaces MUST be migrated" — but only for the 4 canonical roles. `'pastor'` and `'admin'` are outside the canonical enum; adding them would expand the enum scope beyond the spec. The safest path is a typed union that allows both enum values and strings during the transition period.

**Alternatives considered**:
- Add `pastor` and `admin` to `Role` enum — Rejected: expands scope beyond Story 2-4; reconciliation document defines exactly 4 canonical roles.
- Fail hard if non-enum roles are passed — Rejected: would break 5 existing controllers immediately, violating FR-06.

---

## Decision 3 — TenantGuard Resource Tenant Resolution

**Decision**: `TenantGuard` reads the resource's expected `tenantId` from `requestContext.getStore().tenantId` (AsyncLocalStorage), which is already populated by `KeycloakAuthGuard` from the authenticated user's active tenant. For tenant isolation to work, the guard compares `user.tenantId` (from `request.user`) against `requestContext.getStore().tenantId` — effectively confirming the two match.

**Clarification**: The guard does NOT read `tenant_id` from URL params or request body. The `RequestContext` is authoritative; it is set by `KeycloakAuthGuard` via the active-tenant Redis override. The guard's job is to confirm that `request.user.tenantId` matches `requestContext.getStore().tenantId`. If they differ (which could happen if `request.user` is stale), reject with 403.

**Rationale**: `requestContext` is already the authoritative tenant source (confirmed by `keycloak.guard.ts` lines 93-98). Using it as the comparison target is consistent with the existing architecture.

**Alternatives considered**:
- Read tenant from URL path param (`:tenantId`) — Rejected: violates Constitution Principle I ("NUNCA passar tenant_id como parâmetro"); also not all endpoints have a `:tenantId` path param.
- Separate context field for "resource tenant" — Rejected: over-engineering for the current scope; resource tenant is always the active tenant for this platform's access model.

---

## Decision 4 — Pino Logger Access in Guards

**Decision**: Use NestJS `Logger` (which wraps Pino via the configured logger in `main.ts`) via `private readonly logger = new Logger(ClassName.name)`. Do NOT inject `PinoLogger` directly to avoid coupling to the Pino NestJS package version.

**Rationale**: Existing guards (`KeycloakAuthGuard`, line 24) already use `new Logger(KeycloakAuthGuard.name)` — following the same pattern ensures consistency and avoids divergence.

---

## Decision 5 — Integration Test Strategy

**Decision**: Tests live in `apps/api/src/auth/__tests__/` as `tenant.guard.spec.ts` (unit, mocked context) and `auth-layers.integration.spec.ts` (integration, using NestJS `Test.createTestingModule` with mock request pipeline). No full E2E HTTP server needed — NestJS testing utilities provide sufficient guard pipeline simulation.

**Rationale**: Existing test pattern (`keycloak.guard.spec.ts`, `roles.guard.spec.ts`) uses `Test.createTestingModule` without spinning up a real HTTP server. The 3-layer integration test can compose all three guards in a single module and simulate request objects, testing the guard chain without infrastructure dependencies.
