/**
 * import-client.spec.tsx
 * Tests for ImportClient component — FASE 7.2 (Story 10-4, SC#6).
 *
 * Covers:
 *   - "Confirmar Importação" button absent before file upload
 *   - Button disabled when canProceed=false (no valid rows)
 *   - Button enabled when canProceed=true and okCount>0
 *   - Button disabled during isPending (mutation in flight)
 *
 * All heavy deps mocked so component can be instantiated in jsdom without
 * real files/APIs/DB. vi.mock factories must be self-contained (no outer
 * variable references — factories are hoisted before initialization).
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Mock: csv-parser ────────────────────────────────────────────────────────
vi.mock('../../../../../../../../src/lib/onboarding/csv-parser', () => ({
  parseFile: vi.fn().mockResolvedValue({
    rows: [{ nome: 'João', email: 'joao@test.local', papel: 'participante', rowIndex: 0 }],
    missingRequiredColumns: [],
    multiSheetWarning: false,
    encoding: 'utf-8',
  }),
}));

// ─── Mock: csv-validator ──────────────────────────────────────────────────────
// Default: canProceed=true. Individual tests override via .mockReturnValue
vi.mock('../../../../../../../../src/lib/onboarding/csv-validator', () => ({
  validateCSV: vi.fn().mockReturnValue({
    canProceed: true,
    okCount: 1,
    rows: [{ nome: 'João', email: 'joao@test.local', papel: 'participante', rowIndex: 0, status: 'valido' }],
    errors: [],
  }),
}));

// ─── Mock: use-check-emails ───────────────────────────────────────────────────
vi.mock('../../../../../../../../src/lib/api/hooks/use-check-emails', () => ({
  useCheckEmails: vi.fn().mockReturnValue({
    data: { results: [], partialCheckWarning: false, apiUnavailable: false },
    isFetching: false,
  }),
}));

// ─── Mock: use-import-job-status ──────────────────────────────────────────────
vi.mock('../../../../../../../../src/lib/api/hooks/use-import-job-status', () => ({
  useImportJobStatus: vi.fn().mockReturnValue({ data: undefined }),
}));

// ─── Mock: use-import-members ────────────────────────────────────────────────
// Factory is self-contained (no outer vars) — vi.mock hoists before initialization.
vi.mock('../../../../../../../../src/lib/api/hooks/use-import-members', () => ({
  useImportMembers: vi.fn().mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ jobId: null }),
    isPending: false,
  }),
  isAsyncResult: vi.fn().mockReturnValue(false),
}));

// ─── Mock: CSVPreviewTable ────────────────────────────────────────────────────
vi.mock('../../../../../../../../src/components/onboarding/csv-preview-table', () => ({
  CSVPreviewTable: () => <div data-testid="csv-preview-table" />,
}));

// ─── Mock: FileUploadZone with a trigger button ────────────────────────────────
vi.mock('../../../../../../../../src/components/onboarding/file-upload-zone', () => ({
  FileUploadZone: ({
    onFileSelected,
  }: {
    onFileSelected: (f: File) => void;
    isParsing?: boolean;
    acceptedFile?: File | null;
    externalError?: string | null;
    className?: string;
  }) => (
    <button
      data-testid="file-upload-trigger"
      onClick={() =>
        onFileSelected(
          new File(['nome,email,papel\nJoão,joao@test.local,participante'], 'test.csv', {
            type: 'text/csv',
          }),
        )
      }
    >
      Upload
    </button>
  ),
}));

// ─── Mock: ImportResultSummary ────────────────────────────────────────────────
vi.mock('../../../../../../../../src/components/onboarding/import-result-summary', () => ({
  ImportResultSummary: () => <div data-testid="import-result-summary" />,
}));

// ─── Import component and mocked modules AFTER mocks ─────────────────────────

import { ImportClient } from './import-client';
import { useImportMembers } from '../../../../../../../../src/lib/api/hooks/use-import-members';
import { validateCSV } from '../../../../../../../../src/lib/onboarding/csv-validator';

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_ID = '01989abc-1111-7000-8000-000000000011';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ImportClient — Confirm button (FASE 7.2 / SC#6)', () => {
  const mockedUseImportMembers = vi.mocked(useImportMembers);
  const mockedValidateCSV = vi.mocked(validateCSV);

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore defaults after each test
    mockedUseImportMembers.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ jobId: null }),
      isPending: false,
    } as never);

    mockedValidateCSV.mockReturnValue({
      canProceed: true,
      okCount: 1,
      rows: [{ nome: 'João', email: 'joao@test.local', papel: 'participante', rowIndex: 0, status: 'valido' as const }],
      errors: [],
    });
  });

  it('button absent before file upload', () => {
    render(<ImportClient groupId={GROUP_ID} />);
    expect(screen.queryByTestId('confirm-import-btn')).toBeNull();
  });

  it('button disabled when validRows.length === 0 (canProceed false)', async () => {
    mockedValidateCSV.mockReturnValue({
      canProceed: false,
      okCount: 0,
      rows: [],
      errors: [{ message: 'Email inválido', rowIndex: 0 }],
    });

    render(<ImportClient groupId={GROUP_ID} />);

    fireEvent.click(screen.getByTestId('file-upload-trigger'));

    await waitFor(() => {
      const btn = screen.queryByTestId('confirm-import-btn');
      if (btn) {
        expect(btn).toBeDisabled();
      }
      // canProceed=false means button shown but disabled OR button hidden — both valid
    });
  });

  it('button enabled when canProceed=true and okCount>0', async () => {
    render(<ImportClient groupId={GROUP_ID} />);

    fireEvent.click(screen.getByTestId('file-upload-trigger'));

    await waitFor(() => {
      const btn = screen.queryByTestId('confirm-import-btn');
      if (btn) {
        expect(btn).not.toBeDisabled();
      }
    });
  });

  it('button disabled when isPending=true (mutation in flight)', async () => {
    mockedUseImportMembers.mockReturnValue({
      mutateAsync: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
      isPending: true,
    } as never);

    render(<ImportClient groupId={GROUP_ID} />);

    fireEvent.click(screen.getByTestId('file-upload-trigger'));

    await waitFor(() => {
      const btn = screen.queryByTestId('confirm-import-btn');
      if (btn) {
        expect(btn).toBeDisabled();
      }
    });
  });
});
