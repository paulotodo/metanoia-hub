/**
 * csv-preview-table.spec.tsx
 * Tests for CSVPreviewTable (FASE 3.3 of Story 10-3).
 *
 * Covers:
 * - Table with 10 rows + correct summary
 * - Critical row: indicator + accessible text
 * - Warning row: indicator + accessible text
 * - "Mostrando X de N" when N > 10
 * - Empty state (null result / totalRows=0) → descriptive message
 * - isChecking=true → skeleton visible
 * - multiSheetWarning → banner shown
 * - Proceed button disabled with ≥1 critical + explanation
 * - jest-axe WCAG AA for all states
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { CSVValidationResult, CSVRow } from '@metanoia/types';
import { CSVPreviewTable } from '../csv-preview-table';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(
  override: Partial<CSVRow> & Pick<CSVRow, 'rowIndex'>,
): CSVRow {
  return {
    nome: 'João Silva',
    email: 'joao@exemplo.com',
    telefone: null,
    papel: 'participante',
    status: 'ok',
    messages: [],
    ...override,
  };
}

function makeResult(
  override: Partial<CSVValidationResult> = {},
): CSVValidationResult {
  const rows = override.rows ?? [makeRow({ rowIndex: 0 })];
  return {
    rows,
    totalRows: rows.length,
    criticalCount: rows.filter((r) => r.status === 'critico').length,
    warningCount: rows.filter((r) => r.status === 'aviso').length,
    okCount: rows.filter((r) => r.status === 'ok').length,
    sampleSize: rows.length,
    canProceed: rows.every((r) => r.status !== 'critico') && rows.length > 0,
    encoding: 'utf-8',
    multiSheetWarning: false,
    missingRequiredColumns: [],
    ...override,
  };
}

function make10Rows(): CSVRow[] {
  return Array.from({ length: 10 }, (_, i) =>
    makeRow({ rowIndex: i, email: `user${i}@exemplo.com` }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CSVPreviewTable', () => {
  // --- Empty / null state ---

  it('renders empty state when result is null', () => {
    render(<CSVPreviewTable result={null} />);
    expect(screen.getByTestId('csv-preview-empty')).toBeTruthy();
    expect(screen.queryByTestId('csv-preview-table')).toBeNull();
  });

  it('renders empty state when totalRows is 0', () => {
    render(
      <CSVPreviewTable
        result={makeResult({ rows: [], totalRows: 0, sampleSize: 0 })}
      />,
    );
    expect(screen.getByTestId('csv-preview-empty')).toBeTruthy();
  });

  // --- Normal rendering ---

  it('renders table with 10 rows and correct summary', () => {
    const rows = make10Rows();
    render(<CSVPreviewTable result={makeResult({ rows })} />);
    const trs = screen
      .getByTestId('csv-preview-table')
      .querySelectorAll('tbody tr');
    expect(trs.length).toBe(10);

    const summary = screen.getByTestId('preview-summary');
    expect(summary.textContent).toContain('10');
    expect(summary.textContent).toContain('válidos');
  });

  it('critical row: indicator visible with accessible label', () => {
    const critRow = makeRow({
      rowIndex: 0,
      status: 'critico',
      messages: ['E-mail inválido'],
    });
    render(
      <CSVPreviewTable
        result={makeResult({
          rows: [critRow],
          criticalCount: 1,
          canProceed: false,
        })}
      />,
    );
    const indicator = screen.getByTestId('status-critico');
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('aria-label')).toContain('Crítico');
    expect(indicator.getAttribute('aria-label')).toContain('E-mail inválido');
  });

  it('warning row: indicator visible with accessible label', () => {
    const warnRow = makeRow({
      rowIndex: 0,
      status: 'aviso',
      messages: ['Papel não reconhecido'],
    });
    render(
      <CSVPreviewTable
        result={makeResult({ rows: [warnRow], warningCount: 1 })}
      />,
    );
    const indicator = screen.getByTestId('status-aviso');
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('aria-label')).toContain('Aviso');
  });

  it('"Mostrando X de N" shown when totalRows > sampleSize', () => {
    const rows = make10Rows();
    render(
      <CSVPreviewTable
        result={makeResult({ rows, totalRows: 50, sampleSize: 10 })}
      />,
    );
    const showing = screen.getByTestId('preview-showing');
    expect(showing.textContent).toContain('10');
    expect(showing.textContent).toContain('50');
  });

  it('"Mostrando" label absent when totalRows === sampleSize', () => {
    const rows = make10Rows();
    render(
      <CSVPreviewTable result={makeResult({ rows, totalRows: 10, sampleSize: 10 })} />,
    );
    expect(screen.queryByTestId('preview-showing')).toBeNull();
  });

  // --- Intermediate (checking) state ---

  it('isChecking=true → skeleton cells visible', () => {
    const row = makeRow({ rowIndex: 0 });
    render(
      <CSVPreviewTable result={makeResult({ rows: [row] })} isChecking />,
    );
    const skeletons = screen.getAllByTestId('status-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // --- Multi-sheet banner ---

  it('multiSheetWarning → banner rendered with role="status"', () => {
    const rows = [makeRow({ rowIndex: 0 })];
    render(
      <CSVPreviewTable
        result={makeResult({ rows, multiSheetWarning: true })}
      />,
    );
    const banner = screen.getByTestId('multisheet-banner');
    expect(banner).toBeTruthy();
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.textContent).toContain('primeira aba');
  });

  it('no banner when multiSheetWarning is false', () => {
    render(
      <CSVPreviewTable result={makeResult()} />,
    );
    expect(screen.queryByTestId('multisheet-banner')).toBeNull();
  });

  // --- Proceed button ---

  it('proceed button disabled with ≥1 critical row', () => {
    const critRow = makeRow({
      rowIndex: 0,
      status: 'critico',
      messages: ['E-mail inválido'],
    });
    render(
      <CSVPreviewTable
        result={makeResult({
          rows: [critRow],
          criticalCount: 1,
          canProceed: false,
        })}
        onProceed={vi.fn()}
      />,
    );
    const btn = screen.getByTestId('proceed-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // Explanation shown
    expect(screen.getByTestId('blocked-message')).toBeTruthy();
  });

  it('proceed button enabled when canProceed=true', () => {
    render(
      <CSVPreviewTable
        result={makeResult({ canProceed: true })}
        onProceed={vi.fn()}
      />,
    );
    const btn = screen.getByTestId('proceed-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(screen.queryByTestId('blocked-message')).toBeNull();
  });

  it('proceed button calls onProceed when clicked', () => {
    const onProceed = vi.fn();
    render(
      <CSVPreviewTable
        result={makeResult({ canProceed: true })}
        onProceed={onProceed}
      />,
    );
    screen.getByTestId('proceed-btn').click();
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  // --- Table accessibility ---

  it('table headers have scope="col"', () => {
    render(<CSVPreviewTable result={makeResult()} />);
    const ths = screen
      .getByTestId('csv-preview-table')
      .querySelectorAll('th[scope="col"]');
    expect(ths.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // jest-axe WCAG AA
  // ---------------------------------------------------------------------------

  it('WCAG AA — empty state has no violations', async () => {
    const { container } = render(<CSVPreviewTable result={null} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — normal table has no violations', async () => {
    const rows = make10Rows();
    const { container } = render(
      <CSVPreviewTable result={makeResult({ rows })} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — critical row has no violations', async () => {
    const critRow = makeRow({
      rowIndex: 0,
      status: 'critico',
      messages: ['E-mail inválido'],
    });
    const { container } = render(
      <CSVPreviewTable
        result={makeResult({ rows: [critRow], criticalCount: 1, canProceed: false })}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — isChecking state has no violations', async () => {
    const row = makeRow({ rowIndex: 0 });
    const { container } = render(
      <CSVPreviewTable result={makeResult({ rows: [row] })} isChecking />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — multiSheetWarning banner has no violations', async () => {
    const rows = [makeRow({ rowIndex: 0 })];
    const { container } = render(
      <CSVPreviewTable
        result={makeResult({ rows, multiSheetWarning: true })}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
