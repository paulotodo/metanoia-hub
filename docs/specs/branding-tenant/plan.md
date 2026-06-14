# Plan — Branding Customizado do Tenant (Story 11-2)

**short_name:** branding-tenant · **epic:** 11 · **data:** 2026-06-14
**Input:** `docs/specs/branding-tenant/spec.md` · **Constitution:** `docs/constitution.md` v1.0.0

---

## Summary

Admin Tenant customizes church branding: logo upload (MinIO + `sharp` sync
resize), brand colors (CSS custom props), display name. Tier-gated: Free → only
display name; Pro+ → logo + colors + display name. Additive columns on `tenants`,
new endpoints on existing `TenantsController`, service-level gate via
`PlanLimitsService.getPlan()`, Redis write-through cache `cache:branding:{tenantId}`.

**Key technical correction (vs spec/clarify):** the logo strategy. `tenants.logo_url`
stores the **MinIO object key**; the **signed URL is generated on read** and
cached (TTL 1h < signed-URL 4h). This follows the established project pattern
(`content/signed-url`, `reports`, `audit-export`, `privacy-export`, `csv-import`
all persist the object key and sign on read) and the `StorageService.upload()`
contract (returns the key, never a URL). Persisting a signed URL would return
dead links after 4h.

---

## Technical Context

| Field | Value |
|---|---|
| Language | TypeScript (strict), Node |
| Monorepo | Turborepo 2.5+, pnpm 10.33 |
| Backend | NestJS 11.1.17 — module `tenants` (supporting subdomain: service + Prisma direct) |
| Frontend | Next.js 16.2 App Router (Server Components default; CSR for form) |
| DB | PostgreSQL + Prisma v7, RLS multi-tenant |
| Storage | MinIO via `StorageService` (`upload` → key; `getSignedUrl` → presigned, 4h) |
| Cache | Redis (`RedisService` extends ioredis; `@Global`) namespace `cache:*` |
| New dep | `sharp` (direct dep of `@metanoia/api`; `import sharp from 'sharp'`) |
| Contracts | Zod in `packages/types` + snapshot test |
| Testing | Vitest service-level integration + jest-axe (FE a11y) |
| Auth | KeycloakAuthGuard (class) + RolesGuard + `@Roles(Role.ADMIN_TENANT)` |
| NEEDS CLARIFICATION | 0 (all resolved in research.md) |

---

## Constitution Check (GATE — pre-Phase 0)

| Principle | Status | Notes |
|---|---|---|
| I. Multi-tenancy Absoluto | PASS | All reads/writes via `withTenantTx` (tenantId from AsyncLocalStorage, never param). Additive columns inherit existing `tenants` RLS policy; **no policy change → no new isolation spec** (obligation is policy-scoped). Cache key namespaced per tenant. |
| II. Type-Safety & IDs | PASS | strict TS. New columns typed (not JSONB) — matches historical onboarding-wizard decision (read-back K=15). No new UUIDs (scalar attrs of existing Tenant). Nulls explicit in `BrandingResponse`; no `undefined` in JSON. |
| III. Idioma & Vocabulário Pastoral | PASS | Code/Swagger English; user messages PT-BR in `apps/web/messages/pt-BR.json` (`settings.branding.*`); pastoral framing ("Identidade Visual da Igreja"). Icon+text on FE. |
| IV. Contratos de API Padronizados | PASS | Zod `BrandingSchema` in `packages/types` + snapshot. `{ data }` success / `{ statusCode, error, message, details? }` error. `/api/v1/` prefix. Own `ZodValidationPipe`. |
| V. Separação de Estado FE | PASS | Settings page = Server Component (`fetch` native, no TanStack). Form = Client Component with TanStack `useMutation`. No mixing with Zustand. |
| VI. Qualidade Verificável | PASS | service `*.spec.ts` + Zod snapshot + FE jest-axe (WCAG AA: labels, alt, no invalid roles); CI green before done. |
| VII. Processo de Entrega | PASS | 1 story = 1 branch = 1 PR (focused; logo-removal deferred per clarify). Conventional commits PT-BR. Reconciled vs RECONCILIACAO-EPIC11 + real code probe. |

**Gate result: PASS.** No MUST violation. Proceed to Phase 0.

---

## Phase 0 — Research

See `research.md`. 7 decisions, all empirically grounded:
1. Logo URL strategy — DB stores objectKey, sign-on-read + cache (corrects spec §7.3/clarify Q3).
2. DI wiring — TenantsModule imports StorageModule + PlanLimitsModule + RedisModule.
3. RLS — no new spec (additive columns, policy untouched).
4. Upload endpoint contract — multipart `file`, 2MB, 64–512 dims, 200/400/403/422.
5. Tier gate — `PlanLimitsService.getPlan()`, service-level per-field 403.
6. `sharp` direct dep — `pnpm add sharp --filter @metanoia/api`.
7. Testing — service-level integration + ConfigModule.forRoot global.

---

## Phase 1 — Design

- `data-model.md` — 3 additive nullable columns; `logo_url` semantics = object key; cache entity; state transitions.
- `contracts/branding-api.md` — GET/PATCH/POST contracts + Zod schemas.
- `quickstart.md` — 9 scenarios incl. mandatory roundtrip case-convention guard + Zod snapshot.

---

## Convencoes de Borda

| Camada | Case style | Validacao | Fonte da verdade |
|---|---|---|---|
| DB columns (PostgreSQL) | snake_case | migration + Prisma `@map` | `apps/api/prisma/migrations/*_add_branding_columns/migration.sql` |
| Prisma model fields | camelCase | Prisma schema | `apps/api/prisma/schema.prisma` (model `Tenant`) |
| Backend DTO (TS) | camelCase | Zod (`ZodValidationPipe`) | `packages/types/src/tenants/branding.ts` |
| Frontend DTO (TS) | camelCase | Zod parse | re-export from `@metanoia/types` |
| API payload (req/resp) | camelCase | Zod both sides | `contracts/branding-api.md` |
| URL path | kebab/lower (`me/branding`, `me/branding/logo`) | Nest router | `tenants.controller.ts` |

**Mapper layer (DB ↔ DTO):** ORM auto-mapping = **YES** via Prisma `@map`
(snake_case column ↔ camelCase field). No hand-rolled mapper. Service maps Prisma
model → `BrandingResponse` explicitly (anti-mass-assignment, dec-018 pattern).

**Validacao Zod:** both borders — `UpdateBrandingSchema.strict()` on request
(pipe); `BrandingResponseSchema` shape asserted via snapshot. Shared schema in
`packages/types` (single source FE+BE).

**Logo URL boundary:** DB = object key (snake-namespaced path); API/cache =
signed URL. The boundary transform is `getSignedUrl()` on read — declared
explicitly so no expired URL ever crosses to the client.

---

## Project Structure

```
docs/specs/branding-tenant/
├── spec.md                 (exists)
├── research.md             (new — Phase 0)
├── data-model.md           (new — Phase 1)
├── contracts/branding-api.md (new — Phase 1)
├── quickstart.md           (new — Phase 1)
└── plan.md                 (this file)

apps/api/
├── prisma/schema.prisma                    (modify: 3 cols in Tenant)
├── prisma/migrations/<ts>_add_branding_columns/migration.sql (new)
├── package.json                            (modify: + sharp)
└── src/tenants/
    ├── tenants.module.ts                   (modify: imports StorageModule, PlanLimitsModule, RedisModule)
    ├── tenants.controller.ts               (modify: GET/PATCH/POST branding)
    ├── branding.service.ts                 (new — or methods in tenants.service.ts)
    └── __tests__/branding.service.spec.ts  (new — service-level)

packages/types/src/
├── tenants/branding.ts                     (new)
├── index.ts                                (modify: export branding)
└── __tests__/branding.spec.ts             (new — snapshot)

apps/web/src/
├── lib/contrast-checker.ts                 (new)
├── lib/__tests__/contrast-checker.spec.ts (new)
├── app/(authenticated)/admin/settings/branding/page.tsx          (new — Server Component)
├── app/(authenticated)/admin/settings/branding/BrandingSettingsForm.tsx (new — Client Component)
├── app/(authenticated)/layout.tsx          (modify: inject CSS custom props)
└── messages/pt-BR.json                     (modify: settings.branding.*)

pnpm-lock.yaml                              (regenerated — commit with migration)
```

All paths verified against the real tree (tenants module, storage/redis/plan-limits
services, content upload controller all exist as referenced).

---

## DI wiring (boot-crash prevention)

`tenants.module.ts`:
```
imports: [PrismaModule, StorageModule, PlanLimitsModule, RedisModule]
```
- `StorageModule` exports `StorageService` ✓
- `PlanLimitsModule` exports `PlanLimitsService` ✓
- `RedisModule` (@Global) imported explicitly (11-1 defense-in-depth) ✓

`TenantsService`/`BrandingService` constructor injects: `PrismaService`,
`EventEmitter2` (existing), `StorageService`, `PlanLimitsService`, `RedisService`.

---

## CI Guardrails (lições)

| Risk | Mitigation |
|---|---|
| `sharp` missing | `pnpm add sharp --filter @metanoia/api` + commit lock BEFORE code |
| trigger_set_timestamp | NOT created — `@updatedAt` Prisma; zero triggers |
| RLS spec duplication | none — additive cols, policy untouched (Decision 3) |
| DI boot crash (E2E only) | StorageModule + PlanLimitsModule + RedisModule imported |
| `import * as sharp` | `import sharp from 'sharp'` (esModuleInterop) |
| jest-axe a11y | labels+id, alt text, no `role` on `<a>` (11-1 lesson) |
| ConfigModule missing in test | `ConfigModule.forRoot({ isGlobal: true })` |
| cache DEL-only | always write-through SET (Decision 1, spec D4) |
| expired logo URL | DB=objectKey, sign-on-read, cache TTL<expiry (Decision 1) |
| direct push to dev bypasses CI | open a PR; CI only runs on pull_request (memory) |

---

## Security review (owasp-security gate)

OWASP sweep of the attack surface (logo upload, multi-tenant columns, Redis
cache, signed URLs, tier gate). No critical/high findings → no human block.

| # | OWASP | Finding | Severity | Mitigation (in design) |
|---|---|---|---|---|
| S1 | API1 BOLA / cross-tenant | tenant access on branding | mitigated | tenantId from AsyncLocalStorage + `withTenantTx` + existing RLS policy; cache key `cache:branding:{tenantId}`; object key path server-derived `tenants/{tenantId}/...` (never from body/param). |
| S2 | A05 path traversal in object key | malicious filename | mitigated | object key = server `tenantId` (UUID) + **fixed** suffix `logo-nav.png`/`logo-fav.png`; `file.originalname` NEVER used in the key (existing upload uses `safeFilename`; ours is fully fixed — stronger). |
| S3 | A01 upload validation | unrestricted upload | mitigated | server-side: size ≤2MB, mimetype allowlist {png,jpeg,svg+xml}, dims 64–512 via `sharp().metadata()` → 422. |
| S4 | API3 BOPLA mass-assignment | extra body keys | mitigated | `UpdateBrandingSchema.strict()` + explicit field mapping (dec-018), no spread-merge. |
| S5 | A02 signed-URL exposure | presigned URL leak | LOW (info) | tenant-scoped path; TTL 4h; not logged. Acceptable for MVP (matches existing reports/audit-export pattern; import-csv owasp gate classified analogous as MEDIUM-accept). |
| **S6** | **A04/A03 stored XSS via SVG** | **SVG can embed `<script>`/`onload`; served via signed URL same-origin context** | **MEDIUM** | **HARDEN (execute-task):** rasterize SVG to PNG via `sharp` for BOTH nav (128) and fav (64) outputs — the stored objects are always PNG, never the raw SVG. So even if SVG is accepted on input, only sanitized rasterized PNG is persisted/served. Additionally set `Content-Type: image/png` on upload (StorageService already sets it) and recommend `Content-Disposition: inline` + CSP `img-src` on the FE consuming layer. Raw SVG buffer is NEVER stored. |
| **S7** | **A10 decompression/pixel bomb** | **sharp on untrusted image; 2MB byte cap doesn't bound decoded pixels (e.g. tiny highly-compressed huge-canvas PNG)** | **MEDIUM** | **HARDEN (execute-task):** construct sharp with limits — `sharp(buffer, { limitInputPixels: 512*512*4 })` (or a safe absolute cap) and `failOn: 'error'`; reject metadata with width/height > 512 BEFORE resize (the dims check already bounds this, but enforce the `limitInputPixels` guard as defense-in-depth so the decoder itself fails closed). |

**Gate result: PASS (no critical/high).** S6 + S7 are MEDIUM → recorded as
informative Decisions and folded into the implementation contract above (NOT a
human block). S5 LOW → accepted for MVP. S1–S4 mitigated by design.

---

## Re-check Constitution (post-Phase 1)

| Principle | Re-check | Notes |
|---|---|---|
| I. Multi-tenancy | PASS | Design uses `withTenantTx` everywhere; no policy change; tenant-scoped cache. No complexity that weakens isolation. |
| II. Type-Safety | PASS | Typed columns; explicit nulls; no `undefined`. |
| IV. Contratos | PASS | Zod + snapshot; standardized envelopes; roundtrip scenario guards case convention. |
| VI. Qualidade | PASS | Service tests + a11y + snapshot; no new service/layer added (methods on existing tenants module → no unjustified complexity). |

**Post-design gate: PASS.** No new complexity requiring Complexity Tracking.
Branding logic lives in the existing `tenants` module (supporting subdomain →
service + Prisma direct, per Architecture Decisions). No 4th service, no extra
layer.

---

## Complexity Tracking

N/A — no constitution violation; no unjustified complexity introduced.

---

## Next Steps

1. `/checklist` — quality gate before implementing.
2. `/create-tasks` — decompose into backlog.
3. `/analyze` — cross-artifact consistency (after tasks).
