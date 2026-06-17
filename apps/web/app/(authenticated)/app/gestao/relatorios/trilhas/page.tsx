'use client';

import Link from 'next/link';
import { useTrailsSummary } from '@/lib/api/hooks/use-trail-reports';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.trailReports.summary;

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export default function TrailReportsSummaryPage() {
  const { data, isLoading, error } = useTrailsSummary();

  return (
    <section className="py-6">
      <header className="mb-6">
        <h1
          data-testid="trail-reports-title"
          className="text-[24px] font-bold leading-tight text-[var(--color-text-primary)]"
        >
          {t.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.subtitle}</p>
      </header>

      {isLoading && (
        <div
          data-testid="trail-reports-loading"
          className="h-40 motion-safe:animate-pulse rounded-lg bg-[var(--color-surface-muted)]"
        />
      )}

      {error && (
        <p data-testid="trail-reports-error" className="text-sm text-[var(--color-danger)]">
          {t.loadError}
        </p>
      )}

      {data && data.data.length === 0 && (
        <p data-testid="trail-reports-empty" className="text-sm text-[var(--color-text-secondary)]">
          {t.empty}
        </p>
      )}

      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full border-collapse text-sm" data-testid="trail-reports-table">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 font-medium">{t.cols.trail}</th>
                <th className="px-4 py-3 font-medium">{t.cols.participants}</th>
                <th className="px-4 py-3 font-medium">{t.cols.avgProgress}</th>
                <th className="px-4 py-3 font-medium">{t.cols.completed}</th>
                <th className="px-4 py-3 font-medium">{t.cols.notStarted}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((trail) => (
                <tr
                  key={trail.trailId}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                    {trail.trailName}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {trail.totalParticipants}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {formatPercent(trail.avgProgressPercent)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {trail.completedCount}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {trail.notStartedCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      data-testid={`trail-report-open-${trail.trailId}`}
                      href={`/app/gestao/relatorios/trilhas/${trail.trailId}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {t.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
