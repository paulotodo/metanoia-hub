# Story 9-3 — Validation Checklist

Mapping: Story ACs → evidence.

## Acceptance Criteria

| AC | Criterion | Evidence |
|----|-----------|----------|
| AC-1 | Every authenticated POST/PUT/PATCH/DELETE generates an audit event | `audit.integration.spec.ts` 11/11 pass; `audit.interceptor.spec.ts` 27/27 pass |
| AC-2 | Audit events are immutable (no UPDATE/DELETE) | `audit-events.rls-spec.ts` policy tests (DEFERRED-Docker); migration confirms absence of UPDATE/DELETE policies |
| AC-3 | Super Admin can view audit events for any tenant cross-tenant | `super-audit.controller.spec.ts` 9/9 pass; page `/app/admin/super/audit` implemented |
| AC-4 | Viewer shows timestamp, action, severity, resource, userId, IP | page.tsx columns: timestamp, action, severity, resource/resourceId, userId, ipAddress |
| AC-5 | Expandable rows show previousState/newState JSON | JsonPanel component renders formatted JSON; a11y spec tests expanded state |
| AC-6 | Sticky filters: action, severity, dateFrom, dateTo, q | page.tsx useState filters; cleared via clearFilters(); passed to useSuperAdminAuditEvents |
| AC-7 | Auto-refresh every 30s with "Atualizado às HH:MM:SS" | `refetchInterval: 30_000` in useAuditEvents + useSuperAdminAuditEvents; refreshedAt display |
| AC-8 | Server-side pagination with prev/next buttons | meta.page / meta.totalPages; buttons with disabled state |
| AC-9 | Export CSV/JSON via async job (202 + toast) | useTriggerSuperAdminAuditExport mutation; toast on 202 response |
| AC-10 | a11y WCAG AA gate passes | `audit-page.a11y.spec.tsx` 4/4 pass (axe toHaveNoViolations) |

## Build/Lint/Test Results (onda-006)

| Check | Result |
|-------|--------|
| `pnpm prisma generate` | exit 0, no schema errors |
| `pnpm turbo build --filter=@metanoia/web --filter=@metanoia/types` | exit 0, 2/2 tasks successful |
| `pnpm turbo lint --filter=@metanoia/web --filter=@metanoia/types` | exit 0, 3/3 tasks successful, 0 warnings |
| `pnpm turbo test --filter=@metanoia/web --filter=@metanoia/types` | exit 0, 79 test files, 428 tests, 0 failures |

## Deferred Items (require Docker DB)

| Item | Reason | When to verify |
|------|--------|----------------|
| RLS spec `audit-events.rls-spec.ts` run | DATABASE_APP_URL not available in CI-less env | Manual against Docker local or CI with DB service |
| EXPLAIN ANALYZE 10k events (SC-003) | Requires live PostgreSQL with 10k rows | Manual Docker DB test |
| 100k export timing (SC-006) | Requires MinIO + BullMQ running | Manual integration test |

## Files Created/Modified

- `apps/web/src/lib/api/hooks/use-audit-events.ts` — TanStack Query hooks
- `apps/web/src/lib/api/hooks/__tests__/use-audit-events.spec.ts` — 8 unit tests
- `apps/web/mocks/handlers/audit-events.ts` — MSW handlers
- `apps/web/mocks/handlers/index.ts` — registered auditEventsHandlers
- `apps/web/app/(authenticated)/app/admin/super/audit/page.tsx` — viewer page
- `apps/web/app/(authenticated)/app/admin/super/audit/__tests__/audit-page.a11y.spec.tsx` — 4 a11y tests
- `docs/specs/auditoria-log/tasks.md` — FASE 4+5 tasks marked [x]
- `docs/specs/auditoria-log/9-3-validation-checklist.md` — this file
