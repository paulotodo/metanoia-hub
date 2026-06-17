/**
 * axe-baseline-authenticated.spec.ts
 *
 * Accessibility baseline scan for AUTHENTICATED flows BEFORE any a11y corrections.
 * Ref: Story 12.2 (a11y-teclado-autenticado), FASE 0, task 0.1
 *
 * Purpose: capture pre-existing axe violations in authenticated routes as
 * tech-debt reference. Violations found here are NOT blockers; they document
 * the "before" state for delta comparison in FASE 7 (final report).
 *
 * Design decisions:
 * - Chromium-only (playwright.config.ts declares a single "chromium" project)
 * - Runs against local docker-compose stack (E2E_BASE_URL default: localhost:3000)
 * - Auth via UI login (loginAs helper) — same flow as real users
 * - Output: JSON report at apps/web/e2e/a11y/reports/baseline/axe-baseline-authenticated.json
 * - Violations are NOT asserted (test.soft / no expect) — baseline is informational
 */

import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';
import { loginAs } from '../fixtures/auth.fixture';
import {
  E2E_DEMO_ADMIN_EMAIL,
  E2E_DEMO_PASSWORD,
} from '../setup/env';

// ── Types ────────────────────────────────────────────────────────────────────

interface ViolationSummary {
  id: string;
  impact: string | null;
  description: string;
  nodes: number;
}

interface PageResult {
  url: string;
  label: string;
  timestamp: string;
  violations: ViolationSummary[];
  violationCount: number;
  bySeverity: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

// ── Config ───────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(
  process.cwd(),
  'apps/web/e2e/a11y/reports/baseline',
);

/** Authenticated routes to scan (Story 12.2, task 0.1 acceptance criteria). */
const AUTHENTICATED_PAGES = [
  { path: '/app/admin/igreja/dashboard', label: 'dashboard' },
  { path: '/app/admin/grupos', label: 'groups' },
  { path: '/app/consumo/catalogo', label: 'catalog' },
  { path: '/app/admin/configuracoes/branding', label: 'settings-branding' },
  { path: '/app/admin/planos', label: 'plans' },
];

// ── Suite ────────────────────────────────────────────────────────────────────

test.describe('axe baseline — authenticated pages (FASE 0, pre-code-change)', () => {
  const allResults: PageResult[] = [];

  // Authenticate once before all scans to avoid repeated login round-trips.
  // NOTE: state is shared across tests in this describe block intentionally.
  test.beforeAll(async ({ browser }) => {
    // Warm-up: verify the stack is reachable before scanning
    const page = await browser.newPage();
    try {
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch {
      // Non-fatal: if /login is unreachable the individual tests will fail with clear messages
    } finally {
      await page.close();
    }
  });

  for (const route of AUTHENTICATED_PAGES) {
    test(`axe scan: ${route.label} (${route.path})`, async ({ page }) => {
      // 1. Authenticate via UI
      await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);

      // 2. Navigate to target route and wait for full hydration
      await page.goto(route.path, { waitUntil: 'networkidle' });

      // 3. Run axe with broad WCAG tag set
      //    We do NOT fail on violations — this is an informational baseline.
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();

      // 4. Build summary
      const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      const violations: ViolationSummary[] = results.violations.map((v) => {
        const impact = v.impact as keyof typeof bySeverity | null;
        if (impact && impact in bySeverity) {
          bySeverity[impact]++;
        }
        return {
          id: v.id,
          impact: v.impact ?? null,
          description: v.description,
          nodes: v.nodes.length,
        };
      });

      const pageResult: PageResult = {
        url: route.path,
        label: route.label,
        timestamp: new Date().toISOString(),
        violations,
        violationCount: violations.length,
        bySeverity,
      };

      allResults.push(pageResult);

      // 5. Log per-test summary (visible in Playwright HTML report)
      console.log(
        `[axe-baseline-authenticated] ${route.label}: ` +
          `${violations.length} violations ` +
          `(critical=${bySeverity.critical}, serious=${bySeverity.serious}, ` +
          `moderate=${bySeverity.moderate}, minor=${bySeverity.minor})`,
      );
    });
  }

  test.afterAll(async () => {
    // Persist baseline JSON — this artefact is the reference for FASE 7 delta-report.
    const output = {
      feature: 'a11y-teclado-autenticado',
      story: '12.2',
      phase: 'FASE-0-baseline',
      note: 'CHK032: pre-existing violations accepted as tech debt. ' +
            'Reference baseline for Story 12.2 FASE 7 delta-report.',
      scanDate: new Date().toISOString(),
      pages: allResults,
      totalViolations: allResults.reduce((s, r) => s + r.violationCount, 0),
      aggregatedBySeverity: allResults.reduce(
        (acc, r) => {
          acc.critical += r.bySeverity.critical;
          acc.serious += r.bySeverity.serious;
          acc.moderate += r.bySeverity.moderate;
          acc.minor += r.bySeverity.minor;
          return acc;
        },
        { critical: 0, serious: 0, moderate: 0, minor: 0 },
      ),
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const outPath = path.join(OUTPUT_DIR, 'axe-baseline-authenticated.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`[axe-baseline-authenticated] Baseline saved to: ${outPath}`);
  });
});
