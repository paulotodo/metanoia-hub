'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { TrailReportParticipant, TrailReportQuery } from '@metanoia/types';
import {
  useTrailReport,
  useExportTrailCsv,
  useExportJobStatus,
} from '@/lib/api/hooks/use-trail-reports';
import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.trailReports.detail;

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(iso: string | null): string {
  if (!iso) return t.never;
  return DATE_FMT.format(new Date(iso)).replace('.', '');
}

type StatusFilter = TrailReportQuery['status'] | '';

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4">
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: TrailReportParticipant['status'] }) {
  const label = t.status[status];
  const tone =
    status === 'completed'
      ? 'bg-[var(--color-care-urgent)]/10 text-[var(--color-text-primary)]'
      : status === 'in_progress'
        ? 'bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
        : 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export default function TrailReportDetailPage() {
  const params = useParams<{ trailId: string }>();
  const trailId = params.trailId;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('');
  const [after, setAfter] = useState('');
  const [before, setBefore] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);

  const query: Partial<TrailReportQuery> = {
    page,
    perPage: 20,
    ...(status ? { status } : {}),
    ...(after ? { lastActivityAfter: new Date(after).toISOString() } : {}),
    ...(before ? { lastActivityBefore: new Date(before).toISOString() } : {}),
  };

  const { data, isLoading, error } = useTrailReport(trailId, query);
  const exportMutation = useExportTrailCsv();
  const jobStatus = useExportJobStatus(jobId);

  const jobInner = jobStatus.data?.data;
  const isExporting = exportMutation.isPending || jobInner?.status === 'processing';

  async function handleExport() {
    const result = await exportMutation.mutateAsync({ trailId });
    // result === null → inline CSV download already triggered by the hook.
    if (result?.jobId) setJobId(result.jobId);
  }

  function clearFilters() {
    setStatus('');
    setAfter('');
    setBefore('');
    setPage(1);
  }

  const meta = data?.meta;

  return (
    <section className="py-6">
      <Link
        href="/app/gestao/relatorios/trilhas"
        className="text-sm text-[var(--color-primary)] hover:underline"
      >
        ← {t.back}
      </Link>

      <header className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1
          data-testid="trail-report-detail-title"
          className="text-[24px] font-bold leading-tight text-[var(--color-text-primary)]"
        >
          {meta?.trailName ?? t.title}
        </h1>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            data-testid="trail-report-export"
            onClick={handleExport}
            disabled={isExporting}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isExporting ? t.exporting : t.exportCsv}
          </button>
          {jobInner?.status === 'processing' && (
            <span className="text-xs text-[var(--color-text-secondary)]">{t.asyncStarted}</span>
          )}
          {jobInner?.status === 'completed' && jobInner.signedUrl && (
            <a
              data-testid="trail-report-download"
              href={jobInner.signedUrl}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              {t.asyncDownload}
            </a>
          )}
          {jobInner?.status === 'failed' && (
            <span className="text-xs text-[var(--color-danger)]">{t.asyncFailed}</span>
          )}
        </div>
      </header>

      {/* Aggregated metrics (AC #1) — describe the whole trail, not the filtered view */}
      {meta && (
        <div
          data-testid="trail-report-metrics"
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <MetricCard label={t.metrics.avgProgress} value={`${meta.avgProgressPercent}%`} />
          <MetricCard label={t.metrics.completed} value={String(meta.completedCount)} />
          <MetricCard label={t.metrics.inProgress} value={String(meta.inProgressCount)} />
          <MetricCard label={t.metrics.notStarted} value={String(meta.notStartedCount)} />
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          {t.filters.status}
          <select
            data-testid="trail-report-filter-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{t.filters.all}</option>
            <option value="not_started">{t.filters.notStarted}</option>
            <option value="in_progress">{t.filters.inProgress}</option>
            <option value="completed">{t.filters.completed}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          {t.filters.after}
          <input
            type="date"
            data-testid="trail-report-filter-after"
            value={after}
            onChange={(e) => {
              setAfter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          {t.filters.before}
          <input
            type="date"
            data-testid="trail-report-filter-before"
            value={before}
            onChange={(e) => {
              setBefore(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
          />
        </label>
        {(status || after || before) && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-2 py-1.5 text-xs text-[var(--color-primary)] hover:underline"
          >
            {t.filters.clear}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="h-40 motion-safe:animate-pulse rounded-lg bg-[var(--color-surface-muted)]" />
      )}

      {error && (
        <p data-testid="trail-report-detail-error" className="text-sm text-[var(--color-danger)]">
          {t.loadError}
        </p>
      )}

      {data && data.data.length === 0 && (
        <p
          data-testid="trail-report-detail-empty"
          className="text-sm text-[var(--color-text-secondary)]"
        >
          {t.empty}
        </p>
      )}

      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full border-collapse text-sm" data-testid="trail-report-detail-table">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 font-medium">{t.cols.participant}</th>
                <th className="px-4 py-3 font-medium">{t.cols.progress}</th>
                <th className="px-4 py-3 font-medium">{t.cols.modules}</th>
                <th className="px-4 py-3 font-medium">{t.cols.lessons}</th>
                <th className="px-4 py-3 font-medium">{t.cols.lastActivity}</th>
                <th className="px-4 py-3 font-medium">{t.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((p) => (
                <tr
                  key={p.userId}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{p.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{p.progressPercent}%</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {p.completedModules}/{p.totalModules}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {p.completedLessons}/{p.totalLessons}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {formatDate(p.lastActivityAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={meta.page <= 1}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {t.pagination.prev}
          </button>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {t.pagination.page
              .replace('{page}', String(meta.page))
              .replace('{totalPages}', String(meta.totalPages))}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={meta.page >= meta.totalPages}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {t.pagination.next}
          </button>
        </div>
      )}
    </section>
  );
}
