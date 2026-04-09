# Story 11.2: Branding Customizado do Tenant

Status: ready-for-dev

## Story

As a Admin Tenant,
I want to customize the branding of my platform instance with my church's logo, colors, and display name,
So that participants see a familiar, branded experience when accessing our discipleship platform.

## Acceptance Criteria

**Given** I am an Admin Tenant on a Pro or Enterprise plan
**When** I navigate to Settings > "Identidade Visual"
**Then** I can configure:
  - **Logo:** Upload via MinIO (storage policy `permanent`, max 2MB, formats: PNG/JPG/SVG) — displayed in the sidebar/navigation and login page
  - **Colors:** Override `brand-teal` primary color and `brand-teal-light` secondary color via CSS custom properties — input: hex color picker with live preview. A contrast validation check runs on selection: if the chosen color has contrast ratio < 4.5:1 against `surface-base` (#FAFAF8) or `surface-elevated` (#FFFFFF), a warning is displayed: "Esta cor pode dificultar a leitura. Considere uma tonalidade mais escura." (warning only, not blocking — admin has final say)
  - **Display name:** Custom tenant name shown in the header and page titles
**And** changes are saved via `PATCH /api/v1/tenants/current/branding`
**And** branding is applied via CSS custom properties injected at the root layout level — `--color-brand-primary` and `--color-brand-secondary` override the defaults from `tailwind.preset.ts` (Epic 1, Story 1.7)

**Given** I am an Admin Tenant on the Free plan
**When** I navigate to Settings > "Identidade Visual"
**Then** the branding section shows "Disponível no plano Pro" with an upgrade prompt (Story 11.4 pattern)
**And** only the display name field is editable (Free plan includes standard branding with name customization)

**Given** branding is configured
**When** any user in my tenant loads the app
**Then** the custom logo replaces the default metanoia logo in the navigation
**And** the custom colors are applied via CSS custom properties without page reload
**And** the branding is cached in the browser (TanStack Query, staleTime: 30 minutes) and refreshed on next visit after changes

**Given** the logo upload
**When** the image is processed
**Then** the server validates dimensions (min 64x64, max 512x512) and file size (max 2MB)
**And** the image is resized synchronously on upload using `sharp` library (lightweight, native): 128x128 for navigation and 64x64 for favicon (if applicable). Sync processing is acceptable for ≤2MB images
**And** the signed URL for the logo is cached in Redis (`cache:branding:{tenantId}`, TTL 1 hour) to avoid MinIO calls on every page load

## Tasks / Subtasks

- [ ] Task 1: Create branding Prisma schema additions (AC: #1)
  - [ ] 1.1 Add branding fields to tenants table (or separate `TenantBranding` table): `logoUrl`, `primaryColor`, `secondaryColor`, `displayName`
  - [ ] 1.2 Create migration

- [ ] Task 2: Define Zod schemas (AC: #1)
  - [ ] 2.1 Create `packages/types/src/tenants/branding.ts`
  - [ ] 2.2 `TenantBrandingSchema`: logoUrl (optional), primaryColor (hex string), secondaryColor (hex string), displayName
  - [ ] 2.3 Add snapshot tests

- [ ] Task 3: Implement `PATCH /api/v1/tenants/current/branding` endpoint (AC: #1)
  - [ ] 3.1 Add endpoint to tenants controller
  - [ ] 3.2 Plan gating: only Pro/Enterprise can update logo and colors (Free = display name only)
  - [ ] 3.3 Validate payload via Zod
  - [ ] 3.4 Save to database
  - [ ] 3.5 Update Redis cache `cache:branding:{tenantId}` (write-through)

- [ ] Task 4: Implement logo upload and processing (AC: #4)
  - [ ] 4.1 Accept image upload (PNG/JPG/SVG, max 2MB)
  - [ ] 4.2 Validate dimensions (min 64x64, max 512x512)
  - [ ] 4.3 Resize using `sharp`: 128x128 (navigation) and 64x64 (favicon)
  - [ ] 4.4 Upload to MinIO with `permanent` storage policy
  - [ ] 4.5 Generate signed URL, cache in Redis (TTL 1 hour)

- [ ] Task 5: Implement contrast validation utility (AC: #1)
  - [ ] 5.1 Create `apps/web/src/lib/contrast-checker.ts`
  - [ ] 5.2 Calculate contrast ratio against `surface-base` (#FAFAF8) and `surface-elevated` (#FFFFFF)
  - [ ] 5.3 Warn if < 4.5:1 (warning only, not blocking)

- [ ] Task 6: Build branding settings UI (AC: #1, #2)
  - [ ] 6.1 Create `apps/web/src/app/(authenticated)/admin/settings/branding/page.tsx`
  - [ ] 6.2 Logo upload with preview
  - [ ] 6.3 Hex color picker with live preview and contrast warning
  - [ ] 6.4 Display name field
  - [ ] 6.5 Plan gating: show upgrade prompt for Free plan users (logo/colors disabled)
  - [ ] 6.6 Save button with loading state

- [ ] Task 7: Implement CSS custom property injection (AC: #3)
  - [ ] 7.1 In root layout (`apps/web/src/app/layout.tsx`), inject `--color-brand-primary` and `--color-brand-secondary`
  - [ ] 7.2 Override defaults from `tailwind.preset.ts`
  - [ ] 7.3 Branding data fetched via TanStack Query (staleTime: 30 minutes)
  - [ ] 7.4 Custom logo replaces default metanoia logo in sidebar/navigation

- [ ] Task 8: Implement `GET /api/v1/tenants/current/branding` endpoint (AC: #3)
  - [ ] 8.1 Return branding config for current tenant
  - [ ] 8.2 Read from Redis cache first, fallback to DB
  - [ ] 8.3 Include signed logo URL

- [ ] Task 9: Write tests (AC: all)
  - [ ] 9.1 Plan gating test: Free plan → only display name editable
  - [ ] 9.2 Logo validation test: dimensions, file size, format
  - [ ] 9.3 Sharp resize test: 128x128 and 64x64 outputs
  - [ ] 9.4 Contrast warning test: low contrast color → warning displayed
  - [ ] 9.5 CSS injection test: custom properties applied to root
  - [ ] 9.6 Cache test: branding cached in Redis, stale after 1 hour
  - [ ] 9.7 Write-through test: update branding → Redis updated immediately
  - [ ] 9.8 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/tenants/tenants.controller.ts` — add branding endpoints
- `apps/web/src/app/(authenticated)/admin/settings/branding/page.tsx`
- `apps/web/src/lib/contrast-checker.ts`
- `apps/web/src/app/layout.tsx` — CSS custom property injection
- `packages/types/src/tenants/branding.ts`

### Libraries & Versions
- `sharp` (native, lightweight) for image resizing — sync processing for ≤2MB
- MinIO client for logo storage (`permanent` policy)
- Redis for branding cache (`cache:branding:{tenantId}`, TTL 1h)
- TanStack Query 5.96.2 (staleTime: 30min for branding)
- Zod 4.3.6 for validation
- `color2k` or similar for contrast ratio calculation (lightweight, tree-shakeable)

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **Plan gating**: logo + colors require Pro/Enterprise; display name available on Free
- **CSS custom properties**: branding applied via `--color-brand-primary` / `--color-brand-secondary`
- **Write-through cache**: Redis updated on save, not just invalidated
- **Contrast validation**: warning only, admin has final say (WCAG advisory)

### Dependencies
- Epic 1 (Story 1.7) — `tailwind.preset.ts` design tokens to override
- Story 11.1 — plan service for plan gating
- Story 11.4 — upgrade prompt pattern for Free plan
- MinIO infrastructure from Epic 1

### Project Structure Notes
- Branding endpoints on existing tenants controller
- Branding page under admin settings route
- Contrast checker utility in web lib

### References
- `_bmad-output/planning-artifacts/epics/epic-11.md` — Epic 11 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
