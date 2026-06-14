# Quickstart — Branding Customizado do Tenant (Story 11-2)

Critical flows for verification. Backend tests at service level (Decision 7).

---

## Scenario 1 — Pro tenant sets colors + display name (happy path)

1. Seed a Pro tenant (`plan='pro'`) via privileged DATABASE_URL.
2. Call `TenantsService.updateBranding({ primaryColor:'#1E40AF', secondaryColor:'#F59E0B', displayName:'Igreja X' })` inside `withTenantTx`.
3. **Expected:** `tenants` row updated; Redis `cache:branding:{id}` SET (write-through, TTL 3600); response `{ primaryColor, secondaryColor, displayName, plan:'pro', canCustomizeBranding:true }`.

## Scenario 2 — Free tenant tries to set colors (gate)

1. Seed Free tenant (`plan='free'`).
2. Call `updateBranding({ primaryColor:'#1E40AF' })`.
3. **Expected:** `ForbiddenException` (403), actionable PT-BR message; row NOT mutated; no cache write.

## Scenario 3 — Free tenant sets only display name (allowed)

1. Free tenant. `updateBranding({ displayName:'Comunidade Y' })`.
2. **Expected:** persisted; `canCustomizeBranding:false`; 200.

## Scenario 4 — GET branding cache miss then hit

1. Pro tenant with `logo_url` = object key set.
2. First `getBranding()` (cold): DB read → `getSignedUrl(objectKey)` → signed `logoUrl` in response → Redis SET.
3. Second `getBranding()`: **Expected:** served from Redis (no DB hit — assert via Prisma spy), same signed `logoUrl`.
4. **Expected:** persisted `logo_url` is the **object key**, never a signed URL (assert DB column value has no `X-Amz-` query).

## Scenario 5 — Upload logo (resize + store key + sign on response)

1. Pro tenant. `uploadLogo({ buffer: <200x200 PNG>, mimetype:'image/png', size: <2MB })`.
2. **Expected:** `sharp` produces 128×128 + 64×64 PNG buffers; `StorageService.upload` called twice (nav + fav keys); `tenants.logo_url` = `tenants/{id}/logo-nav.png` (object key); response `{ logoUrl: <signed URL> }`; Redis write-through.

## Scenario 6 — Upload rejections

1. File > 2MB → **422** BadRequest/Unprocessable.
2. File 32×32 (< 64) → **422** (dims).
3. mimetype `application/pdf` → **422** (format).
4. Free tenant → **403**.
5. Missing file → **400**.

## Scenario 7 — Contrast checker (FE unit)

1. `checkBrandContrast('#FFFF00')` (yellow vs `#FAFAF8`/`#FFFFFF`).
2. **Expected:** ratios < 4.5 ⇒ `hasWarning:true`. `checkBrandContrast('#000080')` ⇒ ratios ≥ 4.5 ⇒ `hasWarning:false`.

## Scenario 8 — Roundtrip End-to-End (case-convention guard, MANDATORY)

> Per skill §5.3: real backend call, compare payload shape vs contract (no mock).

1. Boot API (docker/CI). Authenticate as Admin Tenant (Pro). `PATCH /api/v1/tenants/me/branding` with `{ "primaryColor":"#1E40AF", "displayName":"X" }`.
2. Capture the raw JSON response body.
3. **Expected:** top-level `data`; keys exactly `primaryColor, secondaryColor, displayName, logoUrl, plan, canCustomizeBranding` (**camelCase**, matching `BrandingResponseSchema`); DB column is `brand_primary_color` (snake_case) — confirms the Prisma `@map` boundary works and no snake_case leaks to the API payload.
4. `GET /api/v1/tenants/me/branding` → same camelCase shape; `logoUrl` is a signed URL or `null` (never a bare object key, never `undefined`).

## Scenario 9 — Snapshot test (Zod gate)

1. `expect(BrandingResponseSchema.shape).toMatchSnapshot()`.
2. **Expected:** snapshot stable; any silent field change fails CI (Constitution IV).
