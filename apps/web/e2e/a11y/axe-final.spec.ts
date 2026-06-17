/**
 * axe-final.spec.ts -- axe-core final scan AFTER a11y code changes (FASE 7)
 *
 * Ref: US7, FR-012, SC-006 -- feature a11y-teclado-publico FASE 7
 *
 * Purpose: capture post-implementation axe violations and compare with baseline.
 * Delta-report generated in afterAll shows which violations were fixed vs new.
 *
 * Baseline reference: _bmad-output/implementation-artifacts/a11y/axe-baseline-public.json
 * Final output:       _bmad-output/implementation-artifacts/a11y/axe-final-public.json
 * Delta output:       _bmad-output/implementation-artifacts/a11y/axe-delta-report.json
 *
 * DoD transversal (from spec SC-006): no NEW critical/serious violations vs baseline.
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

interface DeltaEntry {
  id: string;
  impact: string | null;
  description: string;
  status: 'fixed' | 'regressed' | 'unchanged';
  baseline_nodes: number;
  final_nodes: number;
}

interface PageDelta {
  url: string;
  baseline_count: number;
  final_count: number;
  delta: number; // negative = improvement, positive = regression
  entries: DeltaEntry[];
}

const OUTPUT_DIR = path.join(
  process.cwd(),
  '_bmad-output/implementation-artifacts/a11y'
);

const BASELINE_PATH = path.join(OUTPUT_DIR, 'axe-baseline-public.json');

// Public pages to scan (same as baseline)
const PUBLIC_PAGES = [
  { path: '/', label: 'home-marketing' },
  { path: '/login', label: 'login' },
  { path: '/register', label: 'register' },
  { path: '/recuperar-senha', label: 'recuperar-senha' },
];

test.describe('axe final scan -- public pages (FASE 7, post-code-change)', () => {
  const allResults: PageResult[] = [];

  for (const page of PUBLIC_PAGES) {
    test(`axe final scan: ${page.label} (${page.path})`, async ({ page: pwPage }) => {
      await pwPage.goto(page.path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page: pwPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();

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

      console.log(
        `[axe-final] ${page.label}: ${violations.length} violations ` +
          `(critical:${bySeverity.critical} serious:${bySeverity.serious} ` +
          `moderate:${bySeverity.moderate} minor:${bySeverity.minor})`
      );

      // ASSERT: no new critical or serious violations (DoD transversal SC-006, NC-2/dec-006)
      expect(bySeverity.critical).toBe(0);
      expect(bySeverity.serious).toBe(0);

      // Collect results for afterAll delta generation
      expect(results).toBeDefined();
    });
  }

  test.afterAll(async () => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // --- Save axe-final-public.json ---
    const totalFinal = allResults.reduce((s, r) => s + r.violationCount, 0);
    const aggregatedFinal = allResults.reduce(
      (acc, r) => {
        acc.critical += r.bySeverity.critical;
        acc.serious += r.bySeverity.serious;
        acc.moderate += r.bySeverity.moderate;
        acc.minor += r.bySeverity.minor;
        return acc;
      },
      { critical: 0, serious: 0, moderate: 0, minor: 0 }
    );

    const finalOutput = {
      feature: 'a11y-teclado-publico',
      phase: 'FASE-7-final',
      note: 'Post-implementation axe scan. Compare with axe-baseline-public.json for delta.',
      scanDate: new Date().toISOString(),
      pages: allResults,
      totalViolations: totalFinal,
      aggregatedBySeverity: aggregatedFinal,
    };

    const finalPath = path.join(OUTPUT_DIR, 'axe-final-public.json');
    fs.writeFileSync(finalPath, JSON.stringify(finalOutput, null, 2), 'utf-8');
    console.log(`[axe-final] Final saved to: ${finalPath}`);

    // --- Generate delta-report ---
    let baselineData: typeof finalOutput | null = null;
    if (fs.existsSync(BASELINE_PATH)) {
      try {
        baselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
      } catch {
        console.warn('[axe-delta] Could not parse baseline JSON; delta will be incomplete');
      }
    } else {
      console.warn('[axe-delta] Baseline file not found; delta will be incomplete');
    }

    const pageDeltaList: PageDelta[] = allResults.map((finalPage) => {
      const baselinePage = baselineData?.pages.find((p) => p.url === finalPage.url);
      const baselineViolations: ViolationSummary[] = baselinePage?.violations ?? [];
      const finalViolations: ViolationSummary[] = finalPage.violations;

      const baselineIds = new Set(baselineViolations.map((v) => v.id));
      const finalIds = new Set(finalViolations.map((v) => v.id));

      const entries: DeltaEntry[] = [];

      // Fixed: in baseline but NOT in final
      for (const bv of baselineViolations) {
        if (!finalIds.has(bv.id)) {
          entries.push({
            id: bv.id,
            impact: bv.impact,
            description: bv.description,
            status: 'fixed',
            baseline_nodes: bv.nodes,
            final_nodes: 0,
          });
        }
      }

      // Regressed: in final but NOT in baseline
      for (const fv of finalViolations) {
        if (!baselineIds.has(fv.id)) {
          entries.push({
            id: fv.id,
            impact: fv.impact,
            description: fv.description,
            status: 'regressed',
            baseline_nodes: 0,
            final_nodes: fv.nodes,
          });
        }
      }

      // Unchanged: in both
      for (const bv of baselineViolations) {
        if (finalIds.has(bv.id)) {
          // Non-null safe: finalIds.has(bv.id) guarantees find returns a value
          const fv = finalViolations.find((v) => v.id === bv.id);
          if (!fv) continue;
          entries.push({
            id: bv.id,
            impact: bv.impact,
            description: bv.description,
            status: 'unchanged',
            baseline_nodes: bv.nodes,
            final_nodes: fv.nodes,
          });
        }
      }

      return {
        url: finalPage.url,
        baseline_count: baselineViolations.length,
        final_count: finalViolations.length,
        delta: finalViolations.length - baselineViolations.length,
        entries,
      };
    });

    const totalBaselineViolations = baselineData?.totalViolations ?? 0;
    const regressions = pageDeltaList.flatMap((p) =>
      p.entries.filter((e) => e.status === 'regressed')
    );
    const fixes = pageDeltaList.flatMap((p) =>
      p.entries.filter((e) => e.status === 'fixed')
    );

    const deltaReport = {
      feature: 'a11y-teclado-publico',
      phase: 'FASE-7-delta',
      generatedAt: new Date().toISOString(),
      baseline: {
        file: 'axe-baseline-public.json',
        totalViolations: totalBaselineViolations,
        aggregatedBySeverity: baselineData?.aggregatedBySeverity ?? {},
      },
      final: {
        file: 'axe-final-public.json',
        totalViolations: totalFinal,
        aggregatedBySeverity: aggregatedFinal,
      },
      summary: {
        totalDelta: totalFinal - totalBaselineViolations,
        fixed: fixes.length,
        regressed: regressions.length,
        unchanged: pageDeltaList.flatMap((p) => p.entries.filter((e) => e.status === 'unchanged')).length,
        dod_pass: regressions.filter((r) => r.impact === 'critical').length === 0,
        note: 'DoD transversal SC-006: no new critical violations. dod_pass=true means DoD met.',
      },
      pages: pageDeltaList,
      tech_debt: {
        note: 'CHK032: violations present in baseline are accepted as pre-existing tech debt.',
        unchanged_violations: pageDeltaList.flatMap((p) =>
          p.entries
            .filter((e) => e.status === 'unchanged')
            .map((e) => ({ url: p.url, id: e.id, impact: e.impact, description: e.description }))
        ),
      },
    };

    const deltaPath = path.join(OUTPUT_DIR, 'axe-delta-report.json');
    fs.writeFileSync(deltaPath, JSON.stringify(deltaReport, null, 2), 'utf-8');
    console.log(`[axe-delta] Delta saved to: ${deltaPath}`);

    // Log human-readable summary
    console.log('\n=== AXE DELTA SUMMARY ===');
    console.log(`Baseline violations: ${totalBaselineViolations}`);
    console.log(`Final violations:    ${totalFinal}`);
    console.log(`Net delta:           ${totalFinal - totalBaselineViolations} (negative = improvement)`);
    console.log(`Fixed:      ${fixes.length}`);
    console.log(`Regressed:  ${regressions.length}`);
    console.log(`Unchanged:  ${deltaReport.summary.unchanged}`);
    console.log(`DoD pass:   ${deltaReport.summary.dod_pass}`);
    if (regressions.length > 0) {
      console.log('\nREGRESSIONS:');
      regressions.forEach((r) => console.log(`  - [${r.impact}] ${r.id}: ${r.description}`));
    }
    if (fixes.length > 0) {
      console.log('\nFIXED:');
      fixes.forEach((f) => console.log(`  + [${f.impact}] ${f.id}: ${f.description}`));
    }
    console.log('=========================\n');
  });
});
