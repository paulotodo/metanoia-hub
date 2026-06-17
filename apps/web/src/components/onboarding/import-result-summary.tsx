'use client';

import { useState } from 'react';
import type { ImportResultSummary, ImportResultLine } from '@metanoia/types';
import messages from '../../../messages/pt-BR.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportResultSummaryProps {
  summary: ImportResultSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const t = messages.import;

interface CategoryConfig {
  key: keyof Pick<ImportResultSummary, 'imported' | 'existing' | 'invited' | 'failed'>;
  label: string;
  badgeClass: string;
  actions: ImportResultLine['action'][];
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'imported',
    label: t.result?.imported ?? 'Importados',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    actions: ['created'],
  },
  {
    key: 'existing',
    label: t.result?.existing ?? 'Já existentes',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    actions: ['existing'],
  },
  {
    key: 'invited',
    label: t.result?.invited ?? 'Convites enviados',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    actions: ['invited'],
  },
  {
    key: 'failed',
    label: t.result?.failed ?? 'Falhas',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    actions: ['failed'],
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategorySection({
  config,
  lines,
}: {
  config: CategoryConfig;
  lines: ImportResultLine[];
}) {
  const [open, setOpen] = useState(false);
  const count = lines.length;
  if (count === 0) return null;

  return (
    <section aria-label={config.label} className="rounded-lg border border-border bg-background">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30"
      >
        <span className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.badgeClass}`}
            aria-label={`${count} ${config.label.toLowerCase()}`}
          >
            {count}
          </span>
          <span className="text-sm font-medium text-text-primary">{config.label}</span>
        </span>
        <span aria-hidden="true" className="text-xs text-text-secondary">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul
          role="list"
          className="divide-y divide-border border-t border-border"
          aria-label={`Lista: ${config.label}`}
        >
          {lines.map((line) => (
            <li
              key={`${line.rowIndex}-${line.email}`}
              className="flex flex-col gap-0.5 px-4 py-2 text-sm"
            >
              <span className="font-medium text-text-primary">{line.nome}</span>
              <span className="text-text-secondary">{line.email}</span>
              {line.reason && (
                <span className="text-xs text-red-600" role="alert">
                  {line.reason}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ImportResultSummary — displays the result of a CSV import operation.
 *
 * - 4 collapsible sections: imported (green), existing (gray), invited (amber), failed (red)
 * - Sections with count=0 are hidden
 * - Download link when reportUrl is available
 * - Accessible: headings hierarchy, ARIA labels, role=list
 */
export function ImportResultSummary({ summary }: ImportResultSummaryProps) {
  return (
    <section aria-label="Resultado da importação" data-testid="import-result-summary">
      {/* Summary header */}
      <h2 className="mb-4 text-lg font-semibold text-text-primary">
        Resultado da Importação
      </h2>

      {/* Overall count */}
      <p className="mb-4 text-sm text-text-secondary">
        {summary.total} participantes processados
      </p>

      {/* Category sections */}
      <div className="flex flex-col gap-3" role="list" aria-label="Categorias do resultado">
        {CATEGORIES.map((cat) => {
          const lines = summary.lines.filter((l) => cat.actions.includes(l.action));
          return (
            <div key={cat.key} role="listitem">
              <CategorySection config={cat} lines={lines} />
            </div>
          );
        })}
      </div>

      {/* Download report link */}
      {summary.reportUrl && (
        <div className="mt-6">
          <a
            href={summary.reportUrl}
            download
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30"
            aria-label="Baixar relatório completo da importação"
          >
            {t.result?.download ?? 'Baixar relatório'}
          </a>
        </div>
      )}
    </section>
  );
}
