# API Contracts — Branding (Story 11-2)

Base route: `api/v1/tenants` (existing `TenantsController`, `@UseGuards(KeycloakAuthGuard)`).
All payloads camelCase. Success `{ data }`; error `{ statusCode, error, message, details? }`
(Constitution IV). tenantId always from AsyncLocalStorage (never body/param).

---

## GET /api/v1/tenants/me/branding

Get current tenant branding. Authenticated (any tenant role).

- Guards: `KeycloakAuthGuard` (class) + `@Roles(Role.ADMIN_TENANT)` per spec
  RF-01 (note: spec §7.4 marks it ADMIN_TENANT; keep consistent — only admins
  reach the settings screen).
- Cache: read `cache:branding:{tenantId}`; hit → return; miss → DB (via
  `withTenantTx`) → if `logo_url` present, `getSignedUrl(logo_url, 14400)` →
  build response → write-through Redis (TTL 3600).

**200 Response**
```json
{
  "data": {
    "primaryColor": "#1E40AF",
    "secondaryColor": "#F59E0B",
    "displayName": "Igreja Batista Central",
    "logoUrl": "https://minio.../tenants/<id>/logo-nav.png?X-Amz-...",
    "plan": "pro",
    "canCustomizeBranding": true
  }
}
```
`logoUrl` is a freshly-signed URL (or `null` if no logo). Nulls explicit
(Constitution II — never `undefined`).

---

## PATCH /api/v1/tenants/me/branding

Update colors + display name. JSON body.

- `@HttpCode(200)`, `@UseGuards(RolesGuard)`, `@Roles(Role.ADMIN_TENANT)`,
  `@UsePipes(new ZodValidationPipe(UpdateBrandingSchema))`,
  `@UseInterceptors(ScrubPiiInterceptor)`.
- Gate: `getPlan()` === `'free'` AND body contains `primaryColor` or
  `secondaryColor` → **403**. Free with only `displayName` → OK.
- Persist via `withTenantTx` → `tenant.update` (explicit field mapping,
  anti-mass-assignment per dec-018 pattern). Write-through Redis.

**Request**
```json
{ "primaryColor": "#1E40AF", "secondaryColor": "#F59E0B", "displayName": "Igreja X" }
```
All fields optional. `UpdateBrandingSchema.strict()` rejects unknown keys.

**200 Response** — same shape as GET (`{ data: BrandingResponse }`).

**403 (Free trying colors)**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Personalização de cores está disponível nos planos Pro e Enterprise. Faça upgrade para personalizar a identidade visual.",
  "details": {}
}
```

**422 (invalid hex)** — `ZodValidationPipe` → `{ statusCode: 422, error: "Unprocessable Entity", ... }`
(or 400 depending on the project's pipe; match existing `ZodValidationPipe`
behavior — confirm in execute-task).

---

## POST /api/v1/tenants/me/branding/logo

Upload + resize logo. multipart/form-data, field `file`.

- `@HttpCode(200)`, `@UseGuards(RolesGuard)`, `@Roles(Role.ADMIN_TENANT)`,
  `@UseInterceptors(FileInterceptor('file'))`, `@UploadedFile() file: MulterFile | undefined`.
- Gate: `getPlan()` === `'free'` → **403** actionable.
- Validate: `file` present (else 400); `file.size <= 2*1024*1024` (else 422);
  `file.mimetype ∈ {image/png, image/jpeg, image/svg+xml}` (else 422);
  `sharp(buffer).metadata()` width/height ∈ [64,512] (else 422; SVG without
  raster dims accepted).
- Process (security-hardened — owasp S6/S7): construct sharp with pixel limit
  `sharp(buffer, { limitInputPixels: 512*512*4, failOn: 'error' })`. Always
  **rasterize to PNG** (incl. SVG input → PNG output): `.resize(128,128).png().toBuffer()`
  (nav) + `.resize(64,64).png().toBuffer()` (fav). The stored objects are ALWAYS
  PNG — raw SVG buffer is never persisted/served (kills SVG `<script>` stored-XSS).
- Store: `upload('tenants/{tenantId}/logo-nav.png', navBuf, 'image/png')` →
  returns **object key**; same for fav. Persist nav **object key** in
  `logo_url` via `withTenantTx`.
- Respond + cache: `getSignedUrl(navKey, 14400)` for the response `logoUrl`;
  write-through Redis with the rendered response.

**200 Response**
```json
{ "data": { "logoUrl": "https://minio.../tenants/<id>/logo-nav.png?X-Amz-..." } }
```

**400 (missing file)**
```json
{ "statusCode": 400, "error": "Bad Request", "message": "Arquivo não recebido. Envie o logo no campo \"file\".", "details": {} }
```

**403 (Free)** / **422 (size/format/dims)** — actionable PT-BR messages.

---

## Zod contracts (packages/types)

File: `packages/types/src/tenants/branding.ts` (new), re-exported from
`packages/types/src/index.ts`. Snapshot test in
`packages/types/src/__tests__/branding.spec.ts` (Constitution IV gate).

```typescript
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
export const BrandingColorSchema = z.string().regex(HEX_COLOR_REGEX).max(9);
export const UpdateBrandingSchema = z.object({
  primaryColor: BrandingColorSchema.optional(),
  secondaryColor: BrandingColorSchema.optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
}).strict();                              // anti-mass-assignment
export const BrandingResponseSchema = z.object({
  primaryColor: BrandingColorSchema.nullable(),
  secondaryColor: BrandingColorSchema.nullable(),
  displayName: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  plan: z.enum(['free','pro','enterprise']),
  canCustomizeBranding: z.boolean(),
});
```
