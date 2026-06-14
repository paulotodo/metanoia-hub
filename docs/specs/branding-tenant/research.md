# Research — Branding Customizado do Tenant (Story 11-2)

**Phase 0.** Resolves every unknown before design. All facts probed against
real code (precedence over spec where they diverge).

---

## Decision 1 — Logo URL strategy (DB stores objectKey, sign-on-read)

**Decision:** `tenants.logo_url` stores the **MinIO object key** (stable,
permanent), NOT a signed URL. The signed URL is generated **on read** (in
`getBranding()`) via `StorageService.getSignedUrl(objectKey, 14400)` and the
*resulting signed URL* is what the cached `BrandingResponse` carries (Redis TTL
1h < signed-URL expiry 4h). On cache miss the signed URL is regenerated from the
objectKey — never a persisted, possibly-expired signed URL is returned.

**Rationale (empirical):**
- `apps/api/src/storage/storage.service.ts:48-55` — `upload()` returns the
  **object key**, never a signed URL (docstring: "@returns the object key
  (never a signed URL)"). So persisting "the return of upload" already yields
  the key, not a URL.
- `getSignedUrl()` (`storage.service.ts:60`) calls `presignedGetObject` — these
  **expire** (default 14400s = 4h).
- **Established project precedent:** `apps/api/src/content/signed-url/signed-url.controller.ts:36`
  stores `lesson.contentUrl` (the object key) in DB and calls
  `getSignedUrl(lesson.contentUrl, ...)` **on read**. Same pattern in
  `reports.service.ts:262`, `audit-export.processor.ts:97`,
  `privacy-export.service.ts:235`, `csv-import.service.ts:379` — all persist the
  object key and sign on read.

**Corrects spec incoherence:** spec §7.3 step 7 (`prisma.tenant.update({ data:
{ logoUrl: signedUrl } })`) and clarify Q3 ("return URL from DB as-is") are
**superseded**. Persisting a signed URL would return expired URLs after 4h. The
plan fixes:
1. DB column `logo_url` = object key (e.g. `tenants/{tenantId}/logo-nav.png`).
2. `getBranding()` cold path: read object key from DB → if present, call
   `getSignedUrl(key, 14400)` → build `BrandingResponse.logoUrl` = signed URL →
   write-through Redis (TTL 3600). Cache hit returns the cached signed URL
   (max 1h old, well inside the 4h signed-URL validity).
3. `uploadLogo()`: `StorageService.upload(...)` returns key → persist key in
   `logo_url` → return `{ logoUrl: getSignedUrl(key) }` for immediate FE preview
   + write-through the response (with signed URL) to Redis.

**Cache shape note (important):** cache the *rendered* `BrandingResponse`
(signed `logoUrl`). Because signed-URL TTL (4h) > cache TTL (1h), a cached entry
can never outlive its embedded signed URL. The objectKey lives only in DB; the
cache + API response carry the signed URL.

**Alternatives considered:**
- *Persist signed URL in DB* (spec original) — rejected: expires in 4h, returns
  dead links; contradicts the StorageService contract and all 5 existing
  callers.
- *Cache the object key, sign on every read* — rejected: extra MinIO round-trip
  per request defeats the cache; signing the response once per hour is cheaper.

---

## Decision 2 — DI wiring (TenantsModule imports)

**Decision:** `TenantsModule` adds `StorageModule` and `PlanLimitsModule` to
`imports`. `RedisModule` added too (defense-in-depth, matches 11-1 pattern even
though `RedisService` is injectable globally).

**Rationale (empirical):**
- Current `tenants.module.ts` imports only `PrismaModule` — would crash at boot
  (E2E only) if the service injects `StorageService`/`PlanLimitsService` without
  the owning module imported (lesson 10-4/11-1).
- `StorageModule` (`storage.module.ts`) **exports** `StorageService` — importing
  it makes the provider resolvable. ✓
- `PlanLimitsModule` (`plan-limits.module.ts`) **exports** `PlanLimitsService` —
  importing it makes `getPlan()` resolvable. ✓
- `PlanLimitsModule` itself imports `RedisModule` explicitly "defense in depth
  against accidental de-globalizing (Story 11-1)" — we mirror that.
- `RedisService` is a plain `@Injectable()` extending `ioredis` (`redis.service.ts`).
  Confirm `RedisModule` exports it (it does per existing global usage); import
  for explicitness.

**Result:** `imports: [PrismaModule, StorageModule, PlanLimitsModule, RedisModule]`.
Service constructor injects `PrismaService, EventEmitter2 (existing),
StorageService, PlanLimitsService, RedisService`.

**Alternatives considered:**
- *Rely on @Global for Redis only, skip explicit import* — works at runtime but
  diverges from 11-1 convention; explicit import is the documented project norm.

---

## Decision 3 — RLS (no new spec needed)

**Decision:** No new RLS isolation spec for branding. The 3 new columns are
added to the **existing** `tenants` table which already has the policy
`USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`. Adding
nullable columns does not touch the policy.

**Rationale:** Constitution Principle I MUST clause "toda migration que toque
**policy** de RLS acompanha teste de isolamento". This migration is purely
**additive columns** — it does NOT create/alter/drop any policy. Therefore no
new RLS spec is required (the obligation is policy-scoped, not table-scoped).
Reads/writes go through `withTenantTx` which `SET LOCAL app.current_tenant_id`,
so the existing policy already isolates the new columns.

**Documented decision (audit trail):** migration comment will state "additive
nullable columns; RLS inherited from existing tenants policy; no policy change →
no new isolation spec per Constitution I".

**Alternatives considered:**
- *Add a branding RLS spec anyway* — rejected: redundant; the 9-1 retro flagged
  duplicated/buggy RLS specs as a real cost. Adding one with no policy change is
  noise.

---

## Decision 4 — Upload endpoint contract

**Decision:** `POST /api/v1/tenants/me/branding/logo`, multipart, field name
`file`, `FileInterceptor('file')`, `@Roles(Role.ADMIN_TENANT)`, returns 200 with
`{ data: { logoUrl } }`. Validation: ≤2MB; mimetype ∈ {image/png, image/jpeg,
image/svg+xml}; dims via `sharp(buffer).metadata()` mín 64×64, máx 512×512.
Invalid input → **422** (`UnprocessableEntityException`) for content/dimension
failures; **400** (`BadRequestException`) for missing file; **403** for Free
tier (actionable message). Generates 128×128 (nav) + 64×64 (fav), uploads both,
persists nav object key in `logo_url`.

**Rationale (empirical):**
- `apps/api/src/content/upload/upload.controller.ts:1-60` is the canonical
  `FileInterceptor('file')` + `@UploadedFile() file: MulterFile | undefined` +
  `BadRequestException` on missing file pattern. We reuse the `MulterFile`
  interface shape (`buffer, originalname, mimetype, size`).
- `import sharp from 'sharp'` (default import) per spec D7 — `esModuleInterop:
  true`; CJS lib under Vitest needs default import. Confirmed `esModuleInterop`
  in tsconfig (project uses it; existing `import * as Minio` works but sharp's
  typings export a callable default).
- **SVG dimension caveat:** `sharp().metadata()` may return `density`-based
  dims for SVG; for SVG we accept if width/height present in metadata, else
  treat as vector (skip raster dim bounds but still raster-resize to 128/64 PNG
  for nav/fav). Documented in plan §Edge cases.

**HTTP code choice (422 vs 400):** Constitution IV says Create→201; this is an
update-side-effect upload returning the resource URL, so 200 (matches spec
§7.4 `@HttpCode(HttpStatus.OK)`). Validation failures of *content* (too big,
wrong dims/format) → 422 (semantically correct: well-formed request, invalid
content). Missing file (malformed request) → 400.

**Alternatives considered:**
- *Async 202 + BullMQ resize job* — rejected: spec mandates **synchronous**
  resize (≤2MB, fast); adds queue complexity for no benefit at this size.
- *Single 128×128 only* — rejected: AC4 requires both 128 + 64 (favicon).

---

## Decision 5 — Tier gate (via tenant.plan / PlanLimitsService.getPlan)

**Decision:** Gate via `PlanLimitsService.getPlan(tenantId)` (returns
`TenantPlan` enum, defaults to `'free'`). `plan === 'free'` ⇒ block logo + colors
(403 actionable); display name always allowed. NOT via `PlanLimitsGuard`
(capacity counting) nor `SubscriptionPlan.features.branding` (no such seed).

**Rationale (empirical):**
- `plan-limits.service.ts` exposes `getPlan(tenantId): Promise<TenantPlan>` —
  wraps `withTenantTx`, reads `tenant.plan`, defaults `'free'`. Exactly the
  binary feature-flag read we need (spec D5/D8).
- `PlanLimitsGuard`/`hasCapacity` are for **resource counts** (groups, members,
  leaders) — not a binary tier flag. Spec D5 confirms; using it here would be a
  category error.
- `TenantPlan` = `z.enum(['free','pro','enterprise'])` from
  `packages/types/src/super-admin-tenant.ts` (per spec §2.1).
- Gate lives in the **service** (not a guard) because it's a per-field rule
  (Free can set displayName but not colors) — a guard is all-or-nothing on the
  route. Service-level `ForbiddenException` with actionable PT-BR message.

**Tier read source:** prefer `PlanLimitsService.getPlan(tenantId)` (already
tenant-scoped, cached fallback logic) over a raw `prisma.tenant.findUnique`
select in TenantsService, to reuse the existing read path and avoid duplicating
plan-resolution logic.

**Alternatives considered:**
- *Read `tenant.plan` directly in TenantsService* — works, but `getPlan()`
  already encapsulates it with `withTenantTx`; reuse beats duplication.
- *`SubscriptionPlan.features.branding` flag* — rejected (D8): no seed for it;
  enum gate is simpler and matches existing plan rows.

---

## Decision 6 — sharp as direct dependency

**Decision:** `pnpm add sharp --filter @metanoia/api` BEFORE any code; commit
`pnpm-lock.yaml` with the migration. Types ship with sharp (no `@types/sharp`
needed for sharp ≥0.32). `import sharp from 'sharp'` (default).

**Rationale (empirical + history):**
- Spec D3: `pnpm why sharp` empty → orphan in store; CI-only crash if not a
  direct dep. Memory `cstk_w1b3` + `feedback_feature00c_direct_push_dev` confirm
  CI catches missing deps that local WSL2 (no Docker) misses.
- `import sharp from 'sharp'` (D7) — default, not `* as sharp`, for Vitest CJS
  interop.

**Alternatives considered:**
- *jimp (pure JS)* — rejected: spec mandates sharp; sharp is the established
  fast native resizer and AC4 needs deterministic resize.

---

## Decision 7 — Testing strategy (service-level integration)

**Decision:** Integration tests at the **service** level (TestingModule +
real Prisma/Redis), NOT HTTP/supertest. `ConfigModule.forRoot({ isGlobal: true })`
in the TestingModule. Tenant fixtures seeded via privileged `DATABASE_URL`
(bypass RLS), assertions run via `withTenantTx`.

**Rationale:** spec D6 + memory (`epic9_story_9_1`, `feature00c` gotchas):
`KeycloakAuthGuard` override does not work under Vitest → HTTP-level tests are
unreliable. Service-level is the established project pattern (11-1
`super-admin-plans.*.spec.ts`). Redis spy asserts write-through.

**Alternatives considered:**
- *supertest E2E* — rejected: guard override broken in Vitest (documented).
