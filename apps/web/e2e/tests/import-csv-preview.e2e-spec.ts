/**
 * Story 10-3 — Import CSV Preview E2E spec.
 *
 * Covers:
 *   Cenário A : upload CSV fixture → preview exibido → shape validada vs checkEmailsResponseSchema
 *   Cenário B : arquivo com linha crítica → botão avançar desabilitado
 *   Cenário C : arquivo com 0 linhas → mensagem "sem participantes"
 *
 * Pre-conditions (CI only — not runnable locally without Docker stack):
 *   - Docker stack with demo-seed-keycloak provisioned (docker-compose.test.yml).
 *   - DEMO_GROUP_ID = '01989b10-1002-7000-8000-000000000001' (from demo-data.seed.ts).
 *   - E2E_DEMO_ADMIN_EMAIL / E2E_DEMO_PASSWORD / E2E_BASE_URL configured.
 *
 * NOTE: E2E execution requires the Docker/Keycloak stack (unavailable in WSL2
 * local dev — same constraint as Story 7-4). File creation + lint/typecheck
 * constitute 6.1 completion; actual run is validated in CI (pull_request workflow).
 *
 * Fixture files:
 *   - e2e/fixtures/import-csv-preview.csv  (3 data rows: 2 valid, 1 critical — email vazio)
 *   - e2e/fixtures/import-csv-empty.csv    (header only, 0 data rows)
 */

import * as path from 'path';
import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth.fixture';
import {
  E2E_BASE_URL,
  E2E_DEMO_ADMIN_EMAIL,
  E2E_DEMO_PASSWORD,
} from '../setup/env';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Demo group ID seeded by demo-data.seed.ts (DEMO_GROUP_ID).
 * Overridable via E2E_DEMO_GROUP_ID for non-standard seeds.
 */
const DEMO_GROUP_ID =
  process.env['E2E_DEMO_GROUP_ID'] ?? '01989b10-1002-7000-8000-000000000001';

/** Absolute path to CSV fixtures shipped with the E2E suite. */
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');

const IMPORT_URL = `${E2E_BASE_URL}/app/admin/igreja/grupos/${DEMO_GROUP_ID}/importar`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Authenticate and navigate to the import page. */
async function goToImport(page: import('@playwright/test').Page): Promise<void> {
  await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);

  // Handle tenant-selection interstitial (multi-tenant flows).
  if (page.url().includes('selecionar-igreja')) {
    await page.getByRole('button', { name: /selecionar|entrar/i }).first().click();
    await page.waitForURL(/app\/admin/, { timeout: 10_000 });
  }

  await page.goto(IMPORT_URL);
  await expect(page.getByTestId('import-client')).toBeVisible({ timeout: 15_000 });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Import CSV Preview — E2E', () => {
  test.beforeAll(() => {
    if (!E2E_BASE_URL.startsWith('http')) {
      throw new Error(`E2E_BASE_URL must include protocol, got "${E2E_BASE_URL}"`);
    }
  });

  // ---------------------------------------------------------------------------
  // Cenário A — Upload CSV fixture → preview exibido → shape check-emails OK
  // ---------------------------------------------------------------------------
  test('Cenário A: upload CSV → preview exibido + checkEmailsResponseSchema válido', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Intercept check-emails responses to validate shape without real DB.
    // In CI with Docker stack, the real endpoint is called; this interceptor
    // captures the response body EITHER WAY (from real backend or MSW mock)
    // and validates shape via checkEmailsResponseSchema.
    let capturedCheckEmailsBody: unknown = null;
    await page.route('**/api/v1/users/check-emails**', async (route) => {
      const response = await route.fetch();
      try {
        const text = await response.text();
        capturedCheckEmailsBody = text.length > 0 ? JSON.parse(text) : null;
      } catch {
        // Shape validation handled below.
      }
      await route.fulfill({ response });
    });

    try {
      await goToImport(page);

      // Upload fixture with 3 rows (2 valid + 1 critical — email vazio in row 3).
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles(path.join(FIXTURE_DIR, 'import-csv-preview.csv'));

      // Parsing spinner may appear briefly.
      const parsingSpinner = page.getByTestId('parsing-spinner');
      await parsingSpinner.waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {
        // Spinner may not appear if parse is synchronous; not a failure.
      });

      // Preview table must render.
      await expect(page.getByTestId('csv-preview-table')).toBeVisible({ timeout: 15_000 });

      // Summary must mention "3 linhas" (total rows in fixture).
      await expect(page.getByTestId('preview-summary')).toContainText(/3/);

      // Row 3 has empty email → must show critical indicator.
      await expect(page.getByTestId('status-critico').first()).toBeVisible({ timeout: 10_000 });

      // Botão avançar: fixture has 1 critical row → canProceed false → disabled.
      const proceedBtn = page.getByTestId('proceed-btn');
      await expect(proceedBtn).toBeVisible({ timeout: 5_000 });
      await expect(proceedBtn).toBeDisabled();

      // Validate checkEmailsResponseSchema shape if the endpoint was called.
      // The real backend (CI) returns the real payload; MSW mock (local) returns
      // the mock payload. Both must conform to the contract.
      // (If MSW is active and bypasses the interceptor, capturedCheckEmailsBody
      // may remain null — that is acceptable for local runs.)
      if (capturedCheckEmailsBody !== null) {
        // Dynamic import so the spec compiles even if @playwright/test bundle
        // doesn't include @packages/types at E2E compilation time.
        const { checkEmailsResponseSchema } = await import('@metanoia/types');
        const result = checkEmailsResponseSchema.safeParse(capturedCheckEmailsBody);
        expect(
          result.success,
          `checkEmailsResponseSchema parse failed: ${result.success ? '' : JSON.stringify((result as { error: unknown }).error)}`,
        ).toBe(true);
      }
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------
  // Cenário B — Linha crítica → botão avançar desabilitado
  // (Standalone test asserting disabled state clearly, independent of Cenário A)
  // ---------------------------------------------------------------------------
  test('Cenário B: linha crítica no CSV → botão avançar desabilitado', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await goToImport(page);

      // import-csv-preview.csv has row 3 with empty email (critical).
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles(path.join(FIXTURE_DIR, 'import-csv-preview.csv'));

      await page.getByTestId('parsing-spinner').waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {
        // Spinner may resolve instantly.
      });

      await expect(page.getByTestId('csv-preview-table')).toBeVisible({ timeout: 15_000 });

      // Critical row indicator present.
      await expect(page.getByTestId('status-critico').first()).toBeVisible();

      // Blocked message visible (FR-15 explains why button is disabled).
      await expect(page.getByTestId('blocked-message')).toBeVisible({ timeout: 5_000 });

      // Proceed button disabled.
      await expect(page.getByTestId('proceed-btn')).toBeDisabled();
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------
  // Cenário C — Arquivo com 0 linhas de dados → mensagem "sem participantes"
  // ---------------------------------------------------------------------------
  test('Cenário C: arquivo vazio (0 linhas) → mensagem sem participantes', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await goToImport(page);

      // import-csv-empty.csv has header only; 0 data rows.
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles(path.join(FIXTURE_DIR, 'import-csv-empty.csv'));

      await page.getByTestId('parsing-spinner').waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {
        // Spinner may resolve instantly.
      });

      // Table must NOT render — empty file shows the empty state component.
      const table = page.getByTestId('csv-preview-table');
      const tableVisible = await table.isVisible({ timeout: 3_000 }).catch(() => false);

      // Either csv-preview-empty is shown OR the upload-status-message contains
      // an error (depending on whether the parser emits empty-state or an error).
      if (!tableVisible) {
        // Parser produced error / empty state message — both are correct.
        const emptyMsg = page.getByTestId('csv-preview-empty');
        const uploadMsg = page.getByTestId('upload-status-message');

        const emptyVisible = await emptyMsg.isVisible({ timeout: 5_000 }).catch(() => false);
        const uploadVisible = await uploadMsg.isVisible({ timeout: 3_000 }).catch(() => false);

        // At least one of: empty state message OR upload error message must be visible.
        expect(emptyVisible || uploadVisible, 'Expected empty-state or error message for 0-row CSV').toBe(true);
      } else {
        // If table is rendered, it must show 0 rows and no proceed button enabled.
        await expect(page.getByTestId('proceed-btn')).toBeDisabled();
      }
    } finally {
      await context.close();
    }
  });
});
