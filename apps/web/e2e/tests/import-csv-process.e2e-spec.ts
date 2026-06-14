/**
 * import-csv-process.e2e-spec.ts
 * Story 10-4 — Import CSV Process E2E spec (CI-only).
 *
 * Covers:
 *   Cenário A: Happy path SYNC — upload small CSV (≤100 rows) →
 *              preview → confirmar → ImportResultSummary visible (imported > 0)
 *   Cenário B: Happy path ASYNC — upload large CSV (>100 rows) →
 *              202 accepted → progress bar visible → wait for completed →
 *              ImportResultSummary visible
 *   Cenário C: Plan limit exceeded — mock 403 via MSW → confirm →
 *              error message PT-BR visible
 *
 * Pre-conditions (CI only — not runnable locally without Docker stack):
 *   - Docker stack with demo-seed-keycloak provisioned (docker-compose.test.yml).
 *   - DEMO_GROUP_ID from seed (default: '01989b10-1002-7000-8000-000000000001').
 *   - E2E_DEMO_ADMIN_EMAIL / E2E_DEMO_PASSWORD / E2E_BASE_URL configured.
 *
 * NOTE: This file must NOT be executed locally (Docker/Keycloak unavailable in WSL2).
 * Tests skip when process.env.CI is not set, guarding against accidental local runs.
 *
 * Fixture files:
 *   - e2e/fixtures/import-csv-small.csv  (5 data rows — SYNC path)
 *   - e2e/fixtures/import-csv-large.csv  (101 data rows — ASYNC path)
 */

import * as path from 'path';
import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth.fixture';
import {
  E2E_BASE_URL,
  E2E_DEMO_ADMIN_EMAIL,
  E2E_DEMO_PASSWORD,
} from '../setup/env';

// ─── CI guard ─────────────────────────────────────────────────────────────────

const IS_CI = process.env['CI'] === 'true' || process.env['CI'] === '1';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Demo group ID seeded by demo-data.seed.ts.
 * Overridable via E2E_DEMO_GROUP_ID.
 */
const DEMO_GROUP_ID =
  process.env['E2E_DEMO_GROUP_ID'] ?? '01989b10-1002-7000-8000-000000000001';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');
const SMALL_CSV = path.join(FIXTURE_DIR, 'import-csv-small.csv');
const LARGE_CSV = path.join(FIXTURE_DIR, 'import-csv-large.csv');

const IMPORT_URL = `${E2E_BASE_URL}/app/admin/igreja/grupos/${DEMO_GROUP_ID}/importar`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Authenticate as demo admin and navigate to the import page.
 * Handles tenant-selection interstitial (multi-tenant flows).
 */
async function goToImport(page: import('@playwright/test').Page): Promise<void> {
  await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);

  if (page.url().includes('selecionar-igreja')) {
    await page.getByRole('button', { name: /selecionar|entrar/i }).first().click();
    await page.waitForURL(/app\/admin/, { timeout: 10_000 });
  }

  await page.goto(IMPORT_URL);
  await expect(page.getByTestId('import-client')).toBeVisible({ timeout: 15_000 });
}

/**
 * Upload a file via the hidden <input type="file"> inside FileUploadZone.
 * Uses page.locator to find the input and setInputFiles.
 */
async function uploadFile(
  page: import('@playwright/test').Page,
  csvPath: string,
): Promise<void> {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(csvPath);
}

// ─── Specs ────────────────────────────────────────────────────────────────────

test.describe('Story 10-4 — CSV import process (CI-only)', () => {
  test.beforeEach(async (_fixtures, testInfo) => {
    // Skip all tests in this suite when not running in CI.
    if (!IS_CI) {
      testInfo.skip();
    }
  });

  // ── Cenário A: Happy path SYNC (≤100 rows) ─────────────────────────────────

  test('Cenário A — SYNC: upload small CSV → confirm → ImportResultSummary visible', async ({
    page,
  }) => {
    await goToImport(page);

    // Upload small CSV (5 rows — always SYNC path, ≤100)
    await uploadFile(page, SMALL_CSV);

    // Wait for CSV preview table to appear (validation completed)
    await expect(page.getByTestId('csv-preview-table')).toBeVisible({ timeout: 10_000 });

    // Confirm import button should become enabled
    const confirmBtn = page.getByTestId('confirm-import-btn');
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });

    // Click confirm
    await confirmBtn.click();

    // Wait for ImportResultSummary (sync 201)
    await expect(page.getByTestId('import-result-summary')).toBeVisible({ timeout: 20_000 });

    // Verify at least 1 result counter is present
    await expect(page.getByText(/participantes processados/i)).toBeVisible();
  });

  // ── Cenário B: Happy path ASYNC (>100 rows) ────────────────────────────────

  test('Cenário B — ASYNC: upload large CSV → progress bar → ImportResultSummary', async ({
    page,
  }) => {
    await goToImport(page);

    // Upload large CSV (101 rows — ASYNC path, >100)
    await uploadFile(page, LARGE_CSV);

    await expect(page.getByTestId('csv-preview-table')).toBeVisible({ timeout: 10_000 });

    const confirmBtn = page.getByTestId('confirm-import-btn');
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
    await confirmBtn.click();

    // After 202 Accepted: progress bar should appear
    const progressBar = page.getByRole('progressbar');
    await expect(progressBar).toBeVisible({ timeout: 10_000 });
    await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    await expect(progressBar).toHaveAttribute('aria-valuemax', '100');

    // Poll until completed (up to 60 seconds for async job)
    await expect(page.getByTestId('import-result-summary')).toBeVisible({ timeout: 60_000 });
  });

  // ── Cenário C: Plan limit exceeded ────────────────────────────────────────

  test('Cenário C — plan limit: 403 PlanLimitReached → PT-BR error message visible', async ({
    page,
  }) => {
    // Intercept the import POST and return a 403 PlanLimitReached response
    await page.route('**/api/v1/groups/*/members/import', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 403,
          error: 'PlanLimitReached',
          message: 'Limite do plano atingido. Seu plano permite 50 membros e o grupo já tem 50 (5 novos excederiam o limite).',
          details: { resource: 'membersPerGroup', plan: 'free', current: 50, limit: 50 },
        }),
      });
    });

    await goToImport(page);
    await uploadFile(page, SMALL_CSV);

    await expect(page.getByTestId('csv-preview-table')).toBeVisible({ timeout: 10_000 });

    const confirmBtn = page.getByTestId('confirm-import-btn');
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
    await confirmBtn.click();

    // Error message should appear (PT-BR, from use-import-members hook error handling)
    await expect(page.getByTestId('import-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/limite do plano/i)).toBeVisible({ timeout: 5_000 });
  });
});
