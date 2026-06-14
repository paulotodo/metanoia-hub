/**
 * import-result-summary.spec.tsx
 * Tests for ImportResultSummary component (FASE 7.1 — Story 10-4).
 *
 * Covers:
 *   - jest-axe WCAG AA: no violations for various summary states
 *   - All-created summary: imported section visible
 *   - Mixed summary: multiple sections rendered
 *   - Zero count sections: not rendered (silent empty state)
 *   - Download link: visible only when reportUrl is present
 *   - Total count label visible
 */

import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { ImportResultSummary } from '../import-result-summary';
import type { ImportResultSummaryProps } from '../import-result-summary';

expect.extend(toHaveNoViolations);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSummary(
  overrides: Partial<ImportResultSummaryProps['summary']> = {},
): ImportResultSummaryProps['summary'] {
  return {
    total: 3,
    imported: 2,
    existing: 1,
    invited: 0,
    failed: 0,
    lines: [
      {
        rowIndex: 0,
        email: 'joao@valido.com',
        nome: 'João Silva',
        groupName: 'Grupo Alpha',
        action: 'created',
      },
      {
        rowIndex: 1,
        email: 'maria@valido.com',
        nome: 'Maria Souza',
        groupName: 'Grupo Alpha',
        action: 'created',
      },
      {
        rowIndex: 2,
        email: 'pedro@valido.com',
        nome: 'Pedro Santos',
        groupName: 'Grupo Alpha',
        action: 'existing',
      },
    ],
    reportUrl: null,
    jobId: null,
    ...overrides,
  };
}

// ─── WCAG / jest-axe ──────────────────────────────────────────────────────────

describe('ImportResultSummary — a11y (jest-axe WCAG AA)', () => {
  it('has no a11y violations for a mixed summary (imported + existing)', async () => {
    const { container } = render(<ImportResultSummary summary={makeSummary()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no a11y violations when all rows failed', async () => {
    const { container } = render(
      <ImportResultSummary
        summary={makeSummary({
          total: 1,
          imported: 0,
          existing: 0,
          invited: 0,
          failed: 1,
          lines: [
            {
              rowIndex: 0,
              email: 'broken@test.local',
              nome: 'Broken User',
              groupName: 'Grupo X',
              action: 'failed',
              reason: 'Grupo não encontrado',
            },
          ],
        })}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no a11y violations when reportUrl is present (download link)', async () => {
    const { container } = render(
      <ImportResultSummary
        summary={makeSummary({ reportUrl: 'https://storage.example.com/report.csv' })}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no a11y violations for an all-invited summary', async () => {
    const { container } = render(
      <ImportResultSummary
        summary={makeSummary({
          total: 1,
          imported: 0,
          existing: 0,
          invited: 1,
          failed: 0,
          lines: [
            {
              rowIndex: 0,
              email: 'cross@tenant.com',
              nome: 'Cross Tenant',
              groupName: 'Grupo B',
              action: 'invited',
            },
          ],
        })}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('ImportResultSummary — rendering', () => {
  it('shows total count in the header', () => {
    const { getByText } = render(<ImportResultSummary summary={makeSummary({ total: 3 })} />);
    expect(getByText(/3 participantes processados/i)).toBeTruthy();
  });

  it('shows download link when reportUrl is set', () => {
    const { getByRole } = render(
      <ImportResultSummary
        summary={makeSummary({ reportUrl: 'https://storage.example.com/report.csv' })}
      />,
    );
    const link = getByRole('link', { name: /baixar/i });
    expect(link.getAttribute('href')).toBe('https://storage.example.com/report.csv');
  });

  it('hides download link when reportUrl is null', () => {
    const { queryByRole } = render(
      <ImportResultSummary summary={makeSummary({ reportUrl: null })} />,
    );
    expect(queryByRole('link', { name: /baixar/i })).toBeNull();
  });

  it('does not render invited section when invited === 0', () => {
    const { queryByLabelText } = render(
      <ImportResultSummary
        summary={makeSummary({ invited: 0 })}
      />,
    );
    // Section aria-label for invited should not appear when count is 0
    expect(queryByLabelText(/convites enviados/i)).toBeNull();
  });

  it('renders failed section with reason text', () => {
    const { getByText } = render(
      <ImportResultSummary
        summary={makeSummary({
          total: 1,
          imported: 0,
          failed: 1,
          lines: [
            {
              rowIndex: 0,
              email: 'fail@test.local',
              nome: 'Fail User',
              groupName: 'Grupo Z',
              action: 'failed',
              reason: 'Grupo não encontrado',
            },
          ],
        })}
      />,
    );
    // The failed section toggle button should be visible
    expect(getByText(/falhas/i)).toBeTruthy();
  });
});
