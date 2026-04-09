# Story 12.6: Teste Automatizado de Contraste & axe-core Quality Gate no CI (UX-DR21)

Status: ready-for-dev

## Story

As a developer,
I want automated accessibility checks running in CI,
So that contrast regressions and a11y violations are caught before merge and never reach production.

## Acceptance Criteria

**Given** the project's design tokens
**When** the CI contrast script (`scripts/check-contrast.ts`) runs
**Then** it receives the token file path as parameter (`--tokens-path`), defaulting to `packages/config/tailwind.preset.ts` — never hardcoded
**And** it extracts all color tokens: text colors (`brand-*`, `care-*`, `neutral-*`) and surface colors (`surface-*`, `white`, `brand-*-dark`)
**And** it generates a matrix of all text × surface combinations
**And** it calculates WCAG contrast ratio for each pair using `color2k` (tree-shakeable, actively maintained — preferido sobre `wcag-contrast` que tem manutenção questionável)
**And** it flags any pair below 4.5:1 (normal text) or 3:1 (large text/graphics)

**Given** the script finds contrast violations
**When** it outputs the report
**Then** each violation shows: `[FAIL] text: brand-teal (#3AAFA9) on surface: surface-base (#FAFAF8) → ratio: 3.2:1 (min: 4.5:1)`
**And** it suggests a fix: `Suggestion: use brand-teal-dark (#17252A) instead (ratio: 14.1:1)`
**And** the script exits with code 1, blocking the PR merge

**Given** all token pairs pass contrast checks
**When** the script completes
**Then** it outputs a summary: `✓ {N} color pairs checked. All pass WCAG AA.`
**And** the script exits with code 0
**And** a `--verbose` flag shows ALL pairs (pass + fail) for full audit

**Given** a developer pushes a PR that modifies any file in `packages/config/`, `packages/ui/`, or `scripts/check-contrast.ts`
**When** the GitHub Actions workflow (`.github/workflows/a11y-checks.yml`) runs
**Then** the contrast script runs as one step
**And** `@axe-core/playwright` runs as a second step against the key pages (login, dashboard, groups list, trail detail) — this is a **permanent quality gate**, not limited to Epic 12
**And** both steps must pass for the PR check to succeed
**And** the workflow path filter covers `packages/config/**`, `packages/ui/**`, `apps/web/src/**`, and `scripts/check-contrast.ts`

**Given** a developer needs to understand a failure
**When** they read the CI output
**Then** the contrast script includes a legend explaining WCAG AA thresholds and how to fix
**And** the axe-core step generates an HTML report artifact attached to the workflow run

**Given** the axe-core quality gate runs on E2E
**When** new pages or components are added in future epics
**Then** the page list in the workflow config (`a11y-pages.json`) is extensible — devs add new pages to audit
**And** the workflow README documents how to add pages

**Teste:** Unit test do script com tokens de teste (pares que passam e pares que falham). Integration test do workflow via `act` (GitHub Actions local runner). Verificar que axe-core report é gerado como artifact.

## Tasks / Subtasks

- [ ] Task 1: Create contrast check script (AC: #1, #2, #3)
  - [ ] 1.1 Create `scripts/check-contrast.ts`
  - [ ] 1.2 Accept `--tokens-path` parameter (default: `packages/config/tailwind.preset.ts`)
  - [ ] 1.3 Parse token file to extract color values (text and surface colors)
  - [ ] 1.4 Generate text × surface combination matrix
  - [ ] 1.5 Calculate WCAG contrast ratios using `color2k`
  - [ ] 1.6 Flag pairs below 4.5:1 (normal) or 3:1 (large)
  - [ ] 1.7 Output violations with format: `[FAIL] text: {name} ({hex}) on surface: {name} ({hex}) → ratio: {ratio}:1 (min: {threshold}:1)`
  - [ ] 1.8 Suggest fixes: recommend darker/lighter alternative from token palette
  - [ ] 1.9 Exit code 1 on violations, 0 on pass
  - [ ] 1.10 Summary output: `✓ {N} color pairs checked. All pass WCAG AA.`
  - [ ] 1.11 `--verbose` flag to show all pairs (pass + fail)
  - [ ] 1.12 Legend explaining WCAG AA thresholds in output

- [ ] Task 2: Create a11y pages configuration (AC: #6)
  - [ ] 2.1 Create `a11y-pages.json` with initial page list: login, dashboard, groups list, trail detail
  - [ ] 2.2 Document format for adding new pages
  - [ ] 2.3 Make extensible for future epics

- [ ] Task 3: Create GitHub Actions workflow (AC: #4, #5)
  - [ ] 3.1 Create `.github/workflows/a11y-checks.yml`
  - [ ] 3.2 Path filter: `packages/config/**`, `packages/ui/**`, `apps/web/src/**`, `scripts/check-contrast.ts`
  - [ ] 3.3 Step 1: Run contrast script (`npx tsx scripts/check-contrast.ts`)
  - [ ] 3.4 Step 2: Run Playwright with `@axe-core/playwright` against pages in `a11y-pages.json`
  - [ ] 3.5 Both steps must pass for PR check to succeed
  - [ ] 3.6 Upload axe-core HTML report as workflow artifact
  - [ ] 3.7 Include setup steps: pnpm install, build web app, start dev server

- [ ] Task 4: Create axe-core Playwright test suite (AC: #4)
  - [ ] 4.1 Create `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts`
  - [ ] 4.2 Read pages from `a11y-pages.json`
  - [ ] 4.3 Run `@axe-core/playwright` on each page
  - [ ] 4.4 Generate HTML report artifact
  - [ ] 4.5 Fail on any violations

- [ ] Task 5: Install dependencies (AC: #1)
  - [ ] 5.1 Add `color2k` to devDependencies (tree-shakeable contrast calculator)
  - [ ] 5.2 Add `@axe-core/playwright` to devDependencies
  - [ ] 5.3 Ensure `tsx` available for running TypeScript scripts

- [ ] Task 6: Write unit tests for contrast script (AC: #1, #2, #3)
  - [ ] 6.1 Create `scripts/__tests__/check-contrast.spec.ts`
  - [ ] 6.2 Test with tokens that pass: all pairs ≥ 4.5:1 → exit 0
  - [ ] 6.3 Test with tokens that fail: some pairs < 4.5:1 → exit 1 with violation output
  - [ ] 6.4 Test `--verbose` flag shows all pairs
  - [ ] 6.5 Test `--tokens-path` parameter
  - [ ] 6.6 Test suggestion output for failures

- [ ] Task 7: Write workflow integration test (AC: #4)
  - [ ] 7.1 Test workflow locally via `act` (GitHub Actions local runner)
  - [ ] 7.2 Verify both steps run
  - [ ] 7.3 Verify artifact upload of axe-core report

- [ ] Task 8: Document how to add pages to a11y audit (AC: #6)
  - [ ] 8.1 Add inline comments in `a11y-pages.json` explaining format
  - [ ] 8.2 Add brief docs in workflow file comments

## Dev Notes

### File Paths
- `scripts/check-contrast.ts` — contrast check script
- `scripts/__tests__/check-contrast.spec.ts` — unit tests
- `.github/workflows/a11y-checks.yml` — CI workflow
- `a11y-pages.json` — extensible page list for axe-core
- `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` — E2E axe test suite
- `packages/config/tailwind.preset.ts` — design tokens (input to contrast script)

### Libraries & Versions
- `color2k` — tree-shakeable contrast ratio calculator (preferred over `wcag-contrast`)
- `@axe-core/playwright` — E2E accessibility testing
- Playwright 1.59.1 — E2E test runner
- `tsx` — TypeScript script runner for CI
- Vitest 4.1.2 — unit tests for contrast script

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **Permanent quality gate** — not limited to Epic 12, runs on every relevant PR going forward
- **Extensible page list** — `a11y-pages.json` grows with new features
- **Write-through**: contrast script reads tokens directly (no cache layer)
- **`color2k`** preferred over `wcag-contrast` for active maintenance
- **HTML report artifact** attached to workflow for developer review

### Dependencies
- Story 12.3 — contrast fixes applied before this gate catches regressions
- Epic 1 (Story 1.7) — `tailwind.preset.ts` design tokens
- Epic 1 (Story 1.3) — GitHub Actions CI pipeline

### Project Structure Notes
- Script at root `scripts/` directory
- Workflow in `.github/workflows/`
- Pages config at root level (`a11y-pages.json`)
- E2E tests at `apps/web/e2e/a11y/`

### References
- `_bmad-output/planning-artifacts/epics/epic-12.md` — Epic 12 source
- `docs/project-context.md` — 47 implementation rules (UX-DR21)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
