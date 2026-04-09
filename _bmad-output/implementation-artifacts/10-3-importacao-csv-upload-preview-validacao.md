# Story 10.3: Importação CSV — Upload, Preview & Validação

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to upload a CSV file with participant data and preview it with inline validation before importing,
So that I can bulk-add members to my groups efficiently while catching data errors before they enter the system.

## Acceptance Criteria

**Given** I navigate to group management or a dedicated "Importar Participantes" page
**When** the import wizard loads (Step 1: Upload)
**Then** a `FileUploadZone` component is displayed with:
  - Drag & drop area with visual feedback (border highlight on drag-over)
  - "Selecionar arquivo" button as fallback
  - Accepted formats: `.csv` and `.xlsx` (max 5MB)
  - "Baixar template" link that downloads a CSV template with expected columns: `nome`, `email`, `grupo` (optional — defaults to current group), `papel` (optional — defaults to `participante`)
**And** on file selection, the file is parsed client-side (no upload yet) and row count is displayed: "42 linhas detectadas"
**And** the client-side parser auto-detects file encoding (UTF-8, ISO-8859-1, Windows-1252) and normalizes to UTF-8 before preview — critical for Brazilian CSVs exported from Excel where names like "João" and "Conceição" use legacy encoding
**And** XLSX parsing uses a dynamically imported library (`next/dynamic` / `import()`) to avoid bundling the ~300KB parser in the main chunk — loaded only when the user selects an .xlsx file

**Given** the file is parsed (Step 2: Preview & Validation)
**When** the preview screen loads
**Then** a `CSVPreviewTable` component displays the first 10 rows with all columns
**And** inline auto-validation highlights errors per cell:
  - 🔴 Critical (blocks import): invalid email format, duplicate email within file, duplicate email already in tenant (checked via `GET /api/v1/users/check-emails` batch endpoint)
  - 🟡 Warning (allows import): optional field empty (e.g., grupo not specified)
**And** a validation summary counter is displayed: "{N} válidos, {M} com erro"
**And** the "Próximo" button is disabled while any 🔴 critical errors exist

**Given** critical errors exist (Step 3: Error Resolution)
**When** the error resolution screen loads
**Then** a `ValidationErrorList` component groups errors by type (e.g., "3 e-mails inválidos", "2 e-mails duplicados")
**And** each error row supports inline editing: I can correct the email directly in the table
**And** each error row has an "Ignorar esta linha" option to skip it from import
**And** after resolving all 🔴 errors (via edit or ignore), the "Próximo" button is enabled
**And** re-validation runs automatically after each inline edit

**Given** the file is very large
**When** more than 500 rows are detected
**Then** only the first 10 rows are shown in preview, with a note: "Mostrando 10 de {N} linhas. Todas serão validadas."
**And** validation of all rows happens in the background and the summary counter updates progressively

## Tasks / Subtasks

- [ ] Task 1: Create batch email check endpoint (AC: #2)
  - [ ] 1.1 Implement `GET /api/v1/users/check-emails` accepting `?emails=a@b.com,c@d.com` (batch)
  - [ ] 1.2 Return `{ data: { existing: ["a@b.com"], available: ["c@d.com"] } }`
  - [ ] 1.3 Scope check to current tenant (RLS)
  - [ ] 1.4 Limit batch size to 500 emails per request

- [ ] Task 2: Define Zod schemas for CSV import (AC: #1, #2)
  - [ ] 2.1 Create `packages/types/src/onboarding/csv-import.ts`
  - [ ] 2.2 `CSVRowSchema`: `{ nome: z.string().min(1), email: z.string().email(), grupo: z.string().optional(), papel: z.enum(["participante", "lider"]).optional() }`
  - [ ] 2.3 `CSVValidationResultSchema` for preview results
  - [ ] 2.4 Add snapshot tests

- [ ] Task 3: Build FileUploadZone component (AC: #1)
  - [ ] 3.1 Create `apps/web/src/components/import/file-upload-zone.tsx`
  - [ ] 3.2 Drag & drop with visual feedback (border highlight)
  - [ ] 3.3 "Selecionar arquivo" fallback button
  - [ ] 3.4 File type validation (.csv, .xlsx, max 5MB)
  - [ ] 3.5 "Baixar template" link generating CSV template with headers
  - [ ] 3.6 Row count display after file selection

- [ ] Task 4: Implement client-side CSV/XLSX parser (AC: #1)
  - [ ] 4.1 Create `apps/web/src/lib/csv-parser.ts`
  - [ ] 4.2 Auto-detect encoding (UTF-8, ISO-8859-1, Windows-1252) and normalize to UTF-8
  - [ ] 4.3 Parse CSV with proper delimiter detection (, or ;)
  - [ ] 4.4 Dynamic import for XLSX library (`import()`) — lazy load only when .xlsx selected
  - [ ] 4.5 Return parsed rows as typed array

- [ ] Task 5: Build CSVPreviewTable component (AC: #2)
  - [ ] 5.1 Create `apps/web/src/components/import/csv-preview-table.tsx`
  - [ ] 5.2 Display first 10 rows with all columns
  - [ ] 5.3 Inline validation per cell: red badge for critical, yellow for warning
  - [ ] 5.4 Validation summary counter: "{N} válidos, {M} com erro"
  - [ ] 5.5 "Próximo" button disabled while critical errors exist
  - [ ] 5.6 For >500 rows: "Mostrando 10 de {N} linhas" note

- [ ] Task 6: Implement validation logic (AC: #2)
  - [ ] 6.1 Create `apps/web/src/lib/csv-validator.ts`
  - [ ] 6.2 Critical checks: invalid email format, duplicate email within file, duplicate in tenant (via batch API)
  - [ ] 6.3 Warning checks: optional fields empty
  - [ ] 6.4 Background validation for large files with progressive counter updates

- [ ] Task 7: Build ValidationErrorList component (AC: #3)
  - [ ] 7.1 Create `apps/web/src/components/import/validation-error-list.tsx`
  - [ ] 7.2 Group errors by type with count
  - [ ] 7.3 Inline editing support for each error row
  - [ ] 7.4 "Ignorar esta linha" option per row
  - [ ] 7.5 Auto re-validation after each inline edit
  - [ ] 7.6 "Próximo" enabled when all critical errors resolved

- [ ] Task 8: Build import wizard container (AC: all)
  - [ ] 8.1 Create `apps/web/src/app/(authenticated)/groups/import/page.tsx`
  - [ ] 8.2 3-step wizard: Upload → Preview → Error Resolution
  - [ ] 8.3 Step indicator and navigation
  - [ ] 8.4 Pass validated data to Story 10.4 (confirmation step)

- [ ] Task 9: Write tests (AC: all)
  - [ ] 9.1 CSV parser tests: UTF-8, ISO-8859-1, Windows-1252 encoding detection
  - [ ] 9.2 CSV parser tests: comma and semicolon delimiters
  - [ ] 9.3 Validation tests: invalid emails, duplicates within file, duplicates in tenant
  - [ ] 9.4 Large file test: >500 rows → background validation with progressive updates
  - [ ] 9.5 Inline edit test: fix error → re-validation → error cleared
  - [ ] 9.6 Ignore row test: ignore error row → not included in valid count
  - [ ] 9.7 Template download test
  - [ ] 9.8 XLSX dynamic import test: library loaded only when needed
  - [ ] 9.9 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/web/src/components/import/file-upload-zone.tsx`
- `apps/web/src/components/import/csv-preview-table.tsx`
- `apps/web/src/components/import/validation-error-list.tsx`
- `apps/web/src/lib/csv-parser.ts`
- `apps/web/src/lib/csv-validator.ts`
- `apps/web/src/app/(authenticated)/groups/import/page.tsx`
- `apps/api/src/modules/users/users.controller.ts` — add batch email check
- `packages/types/src/onboarding/csv-import.ts`

### Libraries & Versions
- `papaparse` or similar for CSV parsing (client-side)
- `xlsx` / `sheetjs` for XLSX parsing (dynamically imported, ~300KB)
- Zod 4.3.6 for row validation
- shadcn/ui Table, Badge, Button, Input components
- TanStack Query 5.96.2 for batch email check API call

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- CSV parsing is **client-side** (no server upload until confirmation in Story 10.4)
- Encoding detection is critical for Brazilian Portuguese characters
- XLSX library is **dynamically imported** to avoid main bundle bloat
- Validation combines client-side (format) and server-side (duplicate check) validation
- Progressive validation for large files (>500 rows)

### Dependencies
- Epic 4 — groups API for context (which group to import into)
- Story 10.4 — receives validated data for confirmation and processing
- Users module — batch email check endpoint

### Project Structure Notes
- Import components at `apps/web/src/components/import/`
- Parser/validator utilities at `apps/web/src/lib/`
- Import page under groups route

### References
- `_bmad-output/planning-artifacts/epics/epic-10.md` — Epic 10 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
