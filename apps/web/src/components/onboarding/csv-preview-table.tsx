'use client';

/**
 * csv-preview-table.tsx
 * Shows parsed/validated CSV rows as a preview table.
 *
 * Features (FR-15/16/17/23, UX-02, UX-07):
 * - Up to 10 rows (SAMPLE_SIZE) with inline validation status
 * - Summary: "N participantes lidos — X válidos, Y críticos, Z avisos"
 * - "Mostrando 10 de N linhas" when N > 10 (US2 AC4)
 * - Critical row indicator: 🔴 with aria-label (FR-23)
 * - Warning row indicator: 🟡 with aria-label (FR-23)
 * - Empty state: descriptive message instead of empty table (UX-02-G1)
 * - Intermediate state (isChecking): skeleton cells for email-exists status (UX-02-G2)
 * - Multiple-sheets banner: role="status" non-blocking below summary (UX-07-G1)
 * - Advance button disabled + explanation when canProceed=false (FR-15)
 * - Accessible table: <th scope="col">, status aria-labels (FR-23)
 * - No role="article" anti-pattern (gotcha from Story 6-5)
 */

import type { CSVValidationResult, CSVRow } from '@metanoia/types';
import messages from '../../../messages/pt-BR.json';

const t = messages.import;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CSVPreviewTableProps {
  /** Full validation result from csv-validator. null = not yet parsed. */
  result: CSVValidationResult | null;
  /** True while check-emails API call is in flight (shows skeleton). */
  isChecking?: boolean;
  /** Called when the user clicks "Avançar". Only enabled when canProceed. */
  onProceed?: () => void;
  /** Additional CSS class on the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RowStatusBadge({
  status,
  messages: rowMessages,
  isChecking,
}: {
  status: CSVRow['status'];
  messages: string[];
  isChecking: boolean;
}) {
  if (isChecking) {
    return (
      <span
        role="status"
        className="inline-block h-4 w-16 animate-pulse rounded bg-surface-muted"
        aria-label="Verificando…"
        data-testid="status-skeleton"
      />
    );
  }

  const label = rowMessages.length > 0 ? rowMessages.join('; ') : 'Válido';

  if (status === 'critico') {
    return (
      <span
        className="inline-flex items-center gap-1 text-care-alert"
        aria-label={`Crítico: ${label}`}
        data-testid="status-critico"
        title={label}
      >
        <span aria-hidden="true">🔴</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  if (status === 'aviso') {
    return (
      <span
        className="inline-flex items-center gap-1 text-amber-500"
        aria-label={`Aviso: ${label}`}
        data-testid="status-aviso"
        title={label}
      >
        <span aria-hidden="true">🟡</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-care-positive"
      aria-label="Válido"
      data-testid="status-ok"
    >
      <span aria-hidden="true">✅</span>
      <span className="sr-only">Válido</span>
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <span className="inline-block h-4 w-full animate-pulse rounded bg-surface-muted" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CSVPreviewTable({
  result,
  isChecking = false,
  onProceed,
  className = '',
}: CSVPreviewTableProps) {
  // --- Empty / null state ---
  if (!result || result.totalRows === 0) {
    return (
      <div
        className={[
          'rounded-xl border border-surface-muted bg-surface-subtle p-8 text-center',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        data-testid="csv-preview-empty"
      >
        <p className="text-sm text-text-secondary">{t.preview.empty}</p>
      </div>
    );
  }

  const { rows, totalRows, criticalCount, warningCount, okCount, canProceed, multiSheetWarning, sampleSize } = result;

  // Summary string (FR-16)
  const summaryText = t.preview.summary
    .replace('{{total}}', String(totalRows))
    .replace('{{ok}}', String(okCount))
    .replace('{{critical}}', String(criticalCount))
    .replace('{{warning}}', String(warningCount));

  // "Showing X of N" when totalRows > 10
  const showingText =
    totalRows > sampleSize
      ? t.preview.showing
          .replace('{{shown}}', String(sampleSize))
          .replace('{{total}}', String(totalRows))
      : null;

  return (
    <div
      className={['space-y-3', className].filter(Boolean).join(' ')}
      data-testid="csv-preview-table"
    >
      {/* Summary */}
      <p
        className="text-sm font-medium text-text-primary"
        data-testid="preview-summary"
        aria-live="polite"
      >
        {summaryText}
      </p>

      {showingText && (
        <p className="text-xs text-text-secondary" data-testid="preview-showing">
          {showingText}
        </p>
      )}

      {/* Multi-sheet warning banner (UX-07-G1) */}
      {multiSheetWarning && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          data-testid="multisheet-banner"
        >
          {t.warning.multipleSheets}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-muted">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium text-text-secondary">
                #
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-text-secondary">
                Nome
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-text-secondary">
                E-mail
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-text-secondary">
                Telefone
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-text-secondary">
                Papel
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-text-secondary">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-muted">
            {rows.map((row) => (
              <tr
                key={row.rowIndex}
                className={[
                  'transition-colors',
                  row.status === 'critico'
                    ? 'bg-care-alert/5'
                    : row.status === 'aviso'
                      ? 'bg-amber-50/60'
                      : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <td className="px-3 py-2 text-text-tertiary">{row.rowIndex + 1}</td>
                <td className="px-3 py-2 font-medium text-text-primary">
                  {row.nome || <span className="italic text-text-tertiary">—</span>}
                </td>
                <td className="px-3 py-2 text-text-primary">
                  {row.email || <span className="italic text-text-tertiary">—</span>}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {row.telefone ?? <span className="italic text-text-tertiary">—</span>}
                </td>
                <td className="px-3 py-2 text-text-secondary capitalize">
                  {row.papel}
                </td>
                <td className="px-3 py-2">
                  <RowStatusBadge
                    status={row.status}
                    messages={row.messages}
                    isChecking={isChecking}
                  />
                </td>
              </tr>
            ))}
            {/* Skeleton rows during intermediate state */}
            {isChecking &&
              Array.from({ length: Math.max(0, 3 - rows.length) }).map((_, i) => (
                <SkeletonRow key={`skel-${i}`} />
              ))}
          </tbody>
        </table>
      </div>

      {/* Proceed button (FR-15) */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onProceed}
          disabled={!canProceed || isChecking}
          aria-disabled={!canProceed || isChecking}
          className="rounded-lg bg-interactive-primary px-5 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="proceed-btn"
        >
          {t.preview.proceed}
        </button>

        {!canProceed && !isChecking && (
          <p
            className="text-xs text-care-alert"
            role="alert"
            data-testid="blocked-message"
          >
            {t.preview.blockedByCritical}
          </p>
        )}
      </div>
    </div>
  );
}
