# Implementation Plan: Tenant Selection Residual (Story 2-5)

## Summary

Close the 30% residual of Story 2-5 after WDS Cenário 08:

1. **Auto-select**: when `myTenants.length === 1`, automatically call
   `selectTenant` and redirect to `/app/gestao` without showing the selection
   UI. Implemented as a `useEffect` in `ChurchSelectClient`.

2. **Redis resilience**: upgrade the Redis fallback in `KeycloakAuthGuard` from
   `warn` to `error` (FR-005); add explicit `ServiceUnavailableException` in
   `TenantSelectionService.selectTenant` when the Redis SET fails (FR-007);
   add a co-located resilience policy comment (FR-008).

No new DB migrations, no new Zod schemas, no new routes.

---

## Technical Context

| Field | Value |
|-------|-------|
| Language | TypeScript (strict) |
| Backend | NestJS 11, Redis (ioredis via RedisService) |
| Frontend | Next.js 16 App Router, TanStack Query v5 |
| Validation | Zod 4 in `packages/types` |
| Testing | Vitest (unit + integration), Playwright (e2e) |
| Changed files | `apps/api/src/auth/keycloak.guard.ts` |
| | `apps/api/src/auth/tenant-selection.service.ts` |
| | `apps/web/app/(authenticated)/selecionar-igreja/_components/church-select-client.tsx` |
| | `apps/api/src/auth/__tests__/keycloak.guard.spec.ts` (new test) |
| | `apps/api/src/auth/tenant-selection.service.spec.ts` (new tests) |
| | `apps/web/app/(authenticated)/selecionar-igreja/__tests__/selecionar-igreja-page.spec.tsx` (new tests) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | PASS | No new tables; existing RLS/RequestContext unchanged |
| II. Type-Safety & Identificadores | PASS | No new types; reuses existing Zod schemas |
| III. Idioma & Vocabulário Pastoral | PASS | Logs in English; UI messages already in pt-BR.json |
| IV. Contratos de API Padronizados | PASS | No new endpoints; existing contracts unchanged |
| V. Separação de Estado no Frontend | PASS | `useEffect` in Client Component; no TanStack in RSC |
| VI. Qualidade Verificável | PASS | New unit tests for all changed paths |
| VII. Processo de Entrega Auditável | PASS | 1 story = 1 branch = 1 PR |

---

## Project Structure

```
docs/specs/2-5-tenant-select-residual/
├── spec.md                    ← already exists
├── plan.md                    ← this file
├── research.md
├── data-model.md
└── quickstart.md

apps/api/src/auth/
├── keycloak.guard.ts          ← change: warn → error in resolveActiveTenant
├── tenant-selection.service.ts ← change: catch Redis error in selectTenant → 503
├── tenant-selection.service.spec.ts ← add: Redis failure tests
└── __tests__/
    └── keycloak.guard.spec.ts  ← add: Redis error → error log + fallback test

apps/web/app/(authenticated)/selecionar-igreja/_components/
└── church-select-client.tsx    ← add: auto-select useEffect with hasFired guard

apps/web/app/(authenticated)/selecionar-igreja/__tests__/
└── selecionar-igreja-page.spec.tsx ← add: auto-select + multi-tenant tests
```

---

## Convencoes de Borda

| Layer | Case style | Validation | Source of truth |
|-------|------------|-----------|----------------|
| Redis key | kebab-case (`user:{id}:active-tenant`) | none (opaque string) | `keycloak.guard.ts` + `tenant-selection.service.ts` |
| API payload (request/response) | camelCase | Zod both sides | `packages/types/src/auth/tenant-selection.ts` |
| Frontend hooks | camelCase | Zod parse in hooks | `apps/web/src/lib/api/hooks.ts` |

**ORM auto-mapping**: YES — Prisma maps DB snake_case columns to camelCase TS fields.
**Zod validation**: both sides; shared schemas in `packages/types/src/auth/tenant-selection.ts`.

---

## Implementation Steps

### Backend

**1. `keycloak.guard.ts` — upgrade fallback log level**

In `resolveActiveTenant`, change:
```ts
this.logger.warn(`Failed to read active tenant override for ${userId}: ...`)
```
to:
```ts
this.logger.error(`Redis unavailable; falling back to JWT tenant for ${userId}: ...`)
```
Add the resilience-policy comment per FR-008.

**2. `tenant-selection.service.ts` — explicit 503 on Redis write failure**

Wrap the `this.redis.set(...)` call in a try/catch. On error:
- Log at `error` level with userId and error message.
- Throw `ServiceUnavailableException('Cache unavailable; tenant selection failed')`.
- Add a co-located comment documenting the policy.

### Frontend

**3. `church-select-client.tsx` — auto-select useEffect**

Add a `useRef<boolean>(false)` named `hasFired`. After the `useMyTenants` and
`useSelectTenant` hooks, add:

```tsx
useEffect(() => {
  if (hasFired.current) return;
  if (myTenants.isSuccess && myTenants.data?.length === 1) {
    hasFired.current = true;
    handleSelect(myTenants.data[0].tenantId);
  }
}, [myTenants.isSuccess, myTenants.data]);
```

Guard the existing loading/error render paths to account for the in-flight
auto-select mutation (show the loading indicator while `selectTenant.isPending`
during single-tenant auto-select).

### Tests

**4. `keycloak.guard.spec.ts`** — add test: Redis throws → `logger.error` called,
guard resolves JWT fallback (not rejected).

**5. `tenant-selection.service.spec.ts`** — add tests:
- Redis `set` throws → `selectTenant` rejects with `ServiceUnavailableException`.
- Redis `get` throws (already covered by guard test, not service).

**6. `selecionar-igreja-page.spec.tsx`** — add tests:
- Single tenant → loading indicator shown → redirect to `/app/gestao`.
- Multiple tenants → list shown, no redirect.
- Single tenant, `selectTenant` fails → selection screen shown (no loop).

---

## i18n

New key needed in `apps/web/messages/pt-BR.json` under `churchSelect`:

```json
"autoSelectLoading": "Entrando na sua igreja..."
```

Used as the loading message during auto-select (distinguishable from the generic
data-fetch loading message).
