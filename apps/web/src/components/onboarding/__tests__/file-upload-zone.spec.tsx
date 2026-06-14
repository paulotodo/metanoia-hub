/**
 * file-upload-zone.spec.tsx
 * Tests for FileUploadZone component (FASE 3.2 of Story 10-3).
 *
 * Covers:
 * - CSV accepted → state=accepted
 * - XLSX accepted → state=accepted
 * - >5MB file → error-size + PT-BR message
 * - Invalid extension → error-type + PT-BR message
 * - Download template button → no fetch (calls downloadTemplate mock)
 * - Keyboard: Tab focuses input, Enter/Space triggers file picker natively
 * - Parsing state → spinner visible
 * - jest-axe WCAG AA for all states
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FileUploadZone } from '../file-upload-zone';

// ---------------------------------------------------------------------------
// Mock downloadTemplate so it doesn't touch DOM APIs in jsdom
// ---------------------------------------------------------------------------
vi.mock('../../../lib/onboarding/csv-template', () => ({
  downloadTemplate: vi.fn(),
  TEMPLATE_FILENAME: 'template-importacao-participantes.csv',
}));

import { downloadTemplate } from '../../../lib/onboarding/csv-template';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(
  name: string,
  sizeBytes: number,
  type = 'text/csv',
): File {
  // Create a File with controlled size for tests
  const content = 'a'.repeat(sizeBytes);
  return new File([content], name, { type });
}

function renderDefault(props: Partial<React.ComponentProps<typeof FileUploadZone>> = {}) {
  const onFileSelected = vi.fn();
  const result = render(
    <FileUploadZone onFileSelected={onFileSelected} {...props} />,
  );
  return { ...result, onFileSelected };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileUploadZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in idle state by default', () => {
    const { container } = renderDefault();
    const zone = container.querySelector('[data-state="idle"]');
    expect(zone).not.toBeNull();
  });

  it('CSV file accepted → calls onFileSelected + shows accepted state', () => {
    const { onFileSelected } = renderDefault();
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;

    const csvFile = makeFile('membros.csv', 1024, 'text/csv');
    fireEvent.change(input, { target: { files: [csvFile] } });

    expect(onFileSelected).toHaveBeenCalledWith(csvFile);
    // Re-render with acceptedFile prop to confirm accepted state
    const { container: c2 } = render(
      <FileUploadZone
        onFileSelected={vi.fn()}
        acceptedFile={csvFile}
      />,
    );
    expect(c2.querySelector('[data-state="accepted"]')).not.toBeNull();
  });

  it('XLSX file accepted → calls onFileSelected', () => {
    const { onFileSelected } = renderDefault();
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;

    const xlsxFile = makeFile(
      'membros.xlsx',
      512,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    fireEvent.change(input, { target: { files: [xlsxFile] } });

    expect(onFileSelected).toHaveBeenCalledWith(xlsxFile);
  });

  it('file >5MB → shows error-size state + PT-BR message', () => {
    const { container } = renderDefault();
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;

    const bigFile = makeFile('big.csv', 6 * 1024 * 1024, 'text/csv');
    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(container.querySelector('[data-state="error-size"]')).not.toBeNull();
    expect(screen.getByTestId('upload-status-message').textContent).toContain('5 MB');
  });

  it('invalid extension → shows error-type state + PT-BR message', () => {
    const { container, onFileSelected } = renderDefault();
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;

    const badFile = makeFile('document.pdf', 100, 'application/pdf');
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(container.querySelector('[data-state="error-type"]')).not.toBeNull();
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload-status-message').textContent).toContain('.csv');
  });

  it('download template button → calls downloadTemplate without fetch', () => {
    renderDefault();
    const btn = screen.getByTestId('download-template-btn');
    fireEvent.click(btn);
    // downloadTemplate mock called → no real network needed
    expect(downloadTemplate).toHaveBeenCalledTimes(1);
  });

  it('isParsing=true → shows spinner with aria-label', () => {
    renderDefault({ isParsing: true });
    const spinner = screen.getByTestId('parsing-spinner');
    expect(spinner).toBeTruthy();
    expect(spinner.getAttribute('aria-label')).toContain('Processando');
  });

  it('parsing state hides the idle label', () => {
    renderDefault({ isParsing: true });
    // The upload label should not be present during parsing
    expect(screen.queryByTestId('upload-label')).toBeNull();
  });

  it('keyboard: file input is in the tab order (not sr-only from tabIndex)', () => {
    renderDefault();
    const input = screen.getByTestId('file-upload-input');
    // sr-only class hides visually but keeps in tab order; tabIndex should be 0 (default)
    expect(input.getAttribute('tabindex')).toBeNull(); // default = 0 = focusable
  });

  it('drop CSV file → calls onFileSelected', () => {
    const { onFileSelected, container } = renderDefault();
    const zone = container.querySelector('[data-testid="file-upload-zone"]');
    if (!zone) throw new Error('file-upload-zone not found');

    const csvFile = makeFile('drop.csv', 1024, 'text/csv');
    const dataTransfer = {
      files: [csvFile],
      items: [],
      types: [],
    };

    fireEvent.dragEnter(zone, { dataTransfer });
    fireEvent.dragOver(zone, { dataTransfer });
    fireEvent.drop(zone, { dataTransfer });

    expect(onFileSelected).toHaveBeenCalledWith(csvFile);
  });

  // ---------------------------------------------------------------------------
  // jest-axe WCAG AA tests
  // ---------------------------------------------------------------------------

  it('WCAG AA — idle state has no violations', async () => {
    const { container } = renderDefault();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — error-size state has no violations', async () => {
    const { container } = renderDefault();
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('big.csv', 6 * 1024 * 1024, 'text/csv')] },
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — error-type state has no violations', async () => {
    const { container } = renderDefault();
    const input = screen.getByTestId('file-upload-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('doc.pdf', 100, 'application/pdf')] },
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — accepted state has no violations', async () => {
    const file = makeFile('membros.csv', 1024, 'text/csv');
    const { container } = render(
      <FileUploadZone onFileSelected={vi.fn()} acceptedFile={file} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — parsing state has no violations', async () => {
    const { container } = renderDefault({ isParsing: true });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
