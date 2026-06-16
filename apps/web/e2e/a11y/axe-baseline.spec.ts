/**
 * axe-baseline.spec.ts
 *
 * Accessibility baseline scan for public flows BEFORE any a11y code changes.
 * Ref: US7, FR-012, SC-006 — feature a11y-teclado-publico FASE 0
 *
 * Purpose: capture pre-existing axe violations as tech debt reference.
 * Violations found here are NOT blockers; they are documented in
 * _bmad-output/implementation-artifacts/a11y/axe-baseline-notes.md
 * and serve as the "before" state for delta comparison in FASE 7.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

interface ViolationSummary {
  id: string;
  impact: string | null;
  description: string;
  nodes: number;
}

interface PageResult {
  url: string;
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

const OUTPUT_DIR = path.join(
  process.cwd(),
  '_bmad-output/implementation-artifacts/a11y'
);

// Public pages to scan — no auth required
const PUBLIC_PAGES = [
  { path: '/', label: 'home-marketing' },
  { path: '/login', label: 'login' },
  { path: '/register', label: 'register' },
  { path: '/recuperar-senha', label: 'recuperar-senha' },
];

test.describe('axe baseline — public pages (FASE 0, pre-code-change)', () => {
  const allResults: PageResult[] = [];

  for (const page of PUBLIC_PAGES) {
    test(`axe scan: ${page.label} (${page.path})`, async ({ page: pwPage }) => {
      // Navigate and wait for network idle so client-side components hydrate
      await pwPage.goto(page.path, { waitUntil: 'networkidle' });

      // Run axe scan — collect ALL violations (no impact filter)
      // IMPORTANT: baseline captures pre-existing violations; we do NOT fail on them.
      // This is intentional per CHK032 (violations accepted as tech debt).
      const results = await new AxeBuilder({ page: pwPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();

      // Build summary
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
        url: page.path,
        timestamp: new Date().toISOString(),
        violations,
        violationCount: violations.length,
        bySeverity,
      };

      allResults.push(pageResult);

      // Log summary to test output for visibility
      console.log(
        `[axe-baseline] ${page.label}: ${violations.length} violations ` +
          `(critical:${bySeverity.critical} serious:${bySeverity.serious} ` +
          `moderate:${bySeverity.moderate} minor:${bySeverity.minor})`
      );

      // NO expect().toHaveNoViolations() here — baseline is documentation only
      // We do assert that axe itself ran successfully (no tool errors)
      expect(results).toBeDefined();
      expect(typeof results.violations).toBe('object');
    });
  }

  test.afterAll(async () => {
    // Persist baseline JSON after all page scans complete
    const output = {
      feature: 'a11y-teclado-publico',
      phase: 'FASE-0-baseline',
      note: 'CHK032: pre-existing violations accepted as tech debt. This is the reference baseline for FASE 7 delta-report.',
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
        { critical: 0, serious: 0, moderate: 0, minor: 0 }
      ),
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const outPath = path.join(OUTPUT_DIR, 'axe-baseline-public.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`[axe-baseline] Baseline saved to: ${outPath}`);
  });
});
