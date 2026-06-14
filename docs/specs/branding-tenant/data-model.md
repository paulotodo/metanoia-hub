# Data Model — Branding Customizado do Tenant (Story 11-2)

**Phase 1.** Additive columns on the existing `tenants` table. No new tables, no
RLS policy change.

---

## Entity: Tenant (extended)

Existing model `Tenant` (`apps/api/prisma/schema.prisma` ~line 264) gains 3
nullable columns. Existing fields (`plan`, `logoUrl`, `planLimitsOverride`,
`focusIndicatorEnabled`, `metadata`, `onboardingProgress`, `updatedAt @updatedAt`)
unchanged.

### New fields

| Field (Prisma) | DB column (@map) | Type | Nullable | Constraint | Notes |
|---|---|---|---|---|---|
| `brandPrimaryColor` | `brand_primary_color` | `String?` `@db.VarChar(9)` | yes | hex `#RGB`/`#RRGGBB`/`#RRGGBBAA` (Zod-validated at API) | CSS custom prop `--color-brand-primary` |
| `brandSecondaryColor` | `brand_secondary_color` | `String?` `@db.VarChar(9)` | yes | hex (Zod) | CSS custom prop `--color-brand-secondary` |
| `displayName` | `display_name` | `String?` `@db.VarChar(100)` | yes | trim 1..100 (Zod) | always editable (even Free) |

### Reused field — `logoUrl` (semantics clarified)

| Field | DB column | Type | Stores | NOT |
|---|---|---|---|---|
| `logoUrl` | `logo_url` | `String?` | **MinIO object key** (e.g. `tenants/{tenantId}/logo-nav.png`) | a signed URL (Decision 1) |

The signed URL is **derived on read** (`getSignedUrl(logoUrl, 14400)`), never
persisted. This corrects the spec's original "persist signed URL" path.

### Prisma snippet (additive)

```prisma
// model Tenant — add after logoUrl:
brandPrimaryColor   String?  @map("brand_primary_color") @db.VarChar(9)
brandSecondaryColor String?  @map("brand_secondary_color") @db.VarChar(9)
displayName         String?  @map("display_name") @db.VarChar(100)
```

### Migration SQL (handwritten, additive, nullable)

```sql
-- 20260614xxxxxx_add_branding_columns/migration.sql
-- Additive nullable columns; RLS inherited from existing tenants policy
-- (no policy change → no new isolation spec per Constitution I).
-- NO trigger_set_timestamp — project uses @updatedAt (Prisma). (CI lesson 11-1)
ALTER TABLE tenants ADD COLUMN brand_primary_color VARCHAR(9);
ALTER TABLE tenants ADD COLUMN brand_secondary_color VARCHAR(9);
ALTER TABLE tenants ADD COLUMN display_name VARCHAR(100);
```

---

## Derived / transient: BrandingResponse (API DTO, not persisted)

Computed in `getBranding()`. Shape mirrors `BrandingResponseSchema`
(`packages/types`).

| Field | Source | Type | Notes |
|---|---|---|---|
| `primaryColor` | `tenant.brandPrimaryColor` | `string \| null` | hex or null |
| `secondaryColor` | `tenant.brandSecondaryColor` | `string \| null` | hex or null |
| `displayName` | `tenant.displayName` | `string \| null` | |
| `logoUrl` | `getSignedUrl(tenant.logoUrl)` if key present else `null` | `string \| null` | **signed URL**, regenerated each cold read |
| `plan` | `PlanLimitsService.getPlan()` / `tenant.plan` | `'free'\|'pro'\|'enterprise'` | |
| `canCustomizeBranding` | `plan !== 'free'` | `boolean` | gate flag for FE |

---

## Cache entity: `cache:branding:{tenantId}` (Redis)

| Property | Value |
|---|---|
| Key | `cache:branding:{tenantId}` (namespace `cache:*` per Constitution Arch) |
| Value | `JSON.stringify(BrandingResponse)` — carries the **signed** `logoUrl` |
| TTL | 3600s (1h) via `redis.set(key, val, 'EX', 3600)` |
| Write-through | SET on every GET cold read AND on every PATCH/upload (Decision 1, spec D4) |
| Invariant | TTL (1h) < signed-URL expiry (4h) ⇒ cached `logoUrl` never expired |

---

## State transitions

```
[no branding]
   │  PATCH /me/branding {displayName}          (any plan)
   ▼
[displayName set]
   │  PATCH /me/branding {primaryColor,...}      (Pro+ only; Free→403)
   ▼
[colors set]
   │  POST /me/branding/logo {file}              (Pro+ only; Free→403)
   ▼
[logo set: logo_url = objectKey; cache holds signed URL]
```

Free tenant attempting `primaryColor`/`secondaryColor` or logo upload →
`ForbiddenException` (403) with actionable PT-BR message; never mutates state.

---

## Relationships

None new. Branding columns are scalar attributes of `Tenant`. No FK, no join
table (Decision D1: columns over 1:1 table).
