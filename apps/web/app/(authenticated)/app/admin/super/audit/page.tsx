'use client';

import { useState } from 'react';
import type { AuditAction, AuditSeverity } from '@metanoia/types';
import {
  useSuperAdminAuditEvents,
  useTriggerSuperAdminAuditExport,
} from '@/lib/api/hooks/use-audit-events';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.superAdmin.audit;

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const classMap: Record<AuditSeverity, string> = {
    info: 'bg-[var(--color-muted)] text-[var(--color-text-muted)]',
    warning:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const labelMap: Record<AuditSeverity, string> = {
    info: t.severity.info,
    warning: t.severity.warning,
    critical: t.severity.critical,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classMap[severity]}`}
    >
      {labelMap[severity]}
    </span>
  );
}

// ─── JSON panel ───────────────────────────────────────────────────────────────

function JsonPanel({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown> | null;
}) {
  if (value === null) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">—</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
        {label}
      </p>
      <pre className="overflow-auto rounded bg-[var(--background)] p-2 text-xs leading-relaxed text-[var(--color-text-primary)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAuditPage() {
  // Filters
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [severity, setSeverity] = useState<AuditSeverity | ''>('');
  const [userId, setUserId] = useState('');
  const [resource, setResource] = useState('');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expanded row tracking
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Export state
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const query = useSuperAdminAuditEvents({
    page,
    action: action || undefined,
    severity: severity || undefined,
    userId: userId || undefined,
    resource: resource || undefined,
    q: q || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const exportMutation = useTriggerSuperAdminAuditExport();

  // Last refreshed time display
  const [lastRefreshedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  );

  function clearFilters() {
    setPage(1);
    setAction('');
    setSeverity('');
    setUserId('');
    setResource('');
    setQ('');
    setDateFrom('');
    setDateTo('');
  }

  function handleExport() {
    exportMutation.mutate(
      {
        query: {
          action: action || undefined,
          severity: severity || undefined,
          userId: userId || undefined,
          resource: resource || undefined,
          q: q || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      },
      {
        onSuccess: (data) => {
          setExportJobId(data.jobId);
          setExportToast(t.export.processing);
          setTimeout(() => setExportToast(null), 4000);
        },
        onError: () => {
          setExportToast(t.export.failed);
          setTimeout(() => setExportToast(null), 4000);
        },
      },
    );
  }

  const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <section className="py-6">
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            data-testid="super-audit-title"
            className="text-[24px] font-bold leading-tight text-[var(--color-text-primary)]"
          >
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="super-audit-refreshed-at"
            className="text-xs text-[var(--color-text-muted)]"
          >
            {t.refreshedAt.replace('{time}', lastRefreshedAt)}
          </span>
          <button
            type="button"
            data-testid="super-audit-export-btn"
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--card)] disabled:opacity-50"
          >
            {t.actions.export}
          </button>
        </div>
      </header>

      {/* Export toast */}
      {exportToast !== null && (
        <div
          role="status"
          aria-live="polite"
          data-testid="super-audit-export-toast"
          className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--color-text-primary)]"
        >
          {exportToast}
          {exportJobId !== null && (
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              (jobId: {exportJobId})
            </span>
          )}
        </div>
      )}

      {/* Sticky filters */}
      <div
        data-testid="super-audit-filters"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
      >
        {/* Action filter */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
            {t.filters.action.label}
          </span>
          <select
            data-testid="super-audit-filter-action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AuditAction | '');
              setPage(1);
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{t.filters.action.placeholder}</option>
            <option value="create">{t.filters.action.create}</option>
            <option value="update">{t.filters.action.update}</option>
            <option value="delete">{t.filters.action.delete}</option>
            <option value="login">{t.filters.action.login}</option>
            <option value="logout">{t.filters.action.logout}</option>
            <option value="auth_failure">{t.filters.action.auth_failure}</option>
            <option value="config_change">{t.filters.action.config_change}</option>
            <option value="export">{t.filters.action.export}</option>
          </select>
        </label>

        {/* Severity filter */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
            {t.filters.severity.label}
          </span>
          <select
            data-testid="super-audit-filter-severity"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value as AuditSeverity | '');
              setPage(1);
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{t.filters.severity.placeholder}</option>
            <option value="info">{t.filters.severity.info}</option>
            <option value="warning">{t.filters.severity.warning}</option>
            <option value="critical">{t.filters.severity.critical}</option>
          </select>
        </label>

        {/* Resource search */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
            {t.filters.q}
          </span>
          <input
            data-testid="super-audit-filter-q"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t.filters.qPlaceholder}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:border-[var(--color-brand-teal)] focus-visible:outline-none"
          />
        </label>

        {/* Date from */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
            {t.filters.dateFrom}
          </span>
          <input
            data-testid="super-audit-filter-date-from"
            type="datetime-local"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(
                e.target.value ? new Date(e.target.value).toISOString() : '',
              );
              setPage(1);
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          />
        </label>

        {/* Date to */}
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
            {t.filters.dateTo}
          </span>
          <input
            data-testid="super-audit-filter-date-to"
            type="datetime-local"
            value={dateTo}
            onChange={(e) => {
              setDateTo(
                e.target.value ? new Date(e.target.value).toISOString() : '',
              );
              setPage(1);
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          />
        </label>

        <button
          type="button"
          data-testid="super-audit-filter-clear"
          onClick={clearFilters}
          className="self-end rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--background)]"
        >
          {t.filters.clearAll}
        </button>
      </div>

      {/* Content */}
      {query.isPending ? (
        <div
          data-testid="super-audit-skeleton"
          role="status"
          aria-label={t.table.loading}
          className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 motion-safe:animate-pulse rounded bg-[var(--border)]"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : query.isError ? (
        <div
          data-testid="super-audit-error"
          role="alert"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--color-text-muted)]"
        >
          <p>{t.table.error}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-2 text-sm font-medium text-[var(--color-brand-teal)] underline"
          >
            {t.actions.refresh}
          </button>
        </div>
      ) : query.data.data.length === 0 ? (
        <div
          data-testid="super-audit-empty"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--color-text-muted)]"
        >
          {t.table.empty}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <table
              data-testid="super-audit-table"
              className="w-full text-left text-sm"
            >
              <thead className="border-b border-[var(--border)] bg-[var(--background)]">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                  >
                    {t.table.timestamp}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                  >
                    {t.table.action}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                  >
                    {t.table.severity}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                  >
                    {t.table.resource}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                  >
                    {t.table.member}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                  >
                    {t.table.ipAddress}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                  >
                    {t.table.details}
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((event) => {
                  const isExpanded = expandedId === event.id;
                  return (
                    <>
                      <tr
                        key={event.id}
                        data-testid={`super-audit-row-${event.id}`}
                        className="border-b border-[var(--border)] last:border-0 transition hover:bg-[var(--background)]"
                      >
                        <td className="whitespace-nowrap px-3 py-3 text-[var(--color-text-muted)]">
                          {DATE_FMT.format(new Date(event.timestamp))}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-[var(--color-text-primary)]">
                          {event.action}
                        </td>
                        <td className="px-3 py-3">
                          <SeverityBadge severity={event.severity} />
                        </td>
                        <td className="px-3 py-3 text-[var(--color-text-primary)]">
                          {event.resource}
                          {event.resourceId !== null && (
                            <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                              #{event.resourceId}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                          {event.userId ?? '—'}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                          {event.ipAddress}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            data-testid={`super-audit-expand-${event.id}`}
                            aria-expanded={isExpanded}
                            aria-controls={`super-audit-detail-${event.id}`}
                            onClick={() =>
                              setExpandedId(isExpanded ? null : event.id)
                            }
                            className="text-xs font-medium text-[var(--color-brand-teal)] underline"
                          >
                            {isExpanded ? t.actions.close : t.actions.viewDetails}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr
                          key={`${event.id}-detail`}
                          id={`super-audit-detail-${event.id}`}
                          data-testid={`super-audit-detail-${event.id}`}
                        >
                          <td
                            colSpan={7}
                            className="bg-[var(--background)] px-4 py-3"
                          >
                            <div className="grid gap-4 sm:grid-cols-2">
                              <JsonPanel
                                label={t.table.previousState}
                                value={event.previousState}
                              />
                              <JsonPanel
                                label={t.table.newState}
                                value={event.newState}
                              />
                            </div>
                            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                              <strong>User-Agent:</strong> {event.userAgent}
                            </p>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <span data-testid="super-audit-pagination-info">
              {t.pagination
                .replace(
                  '{from}',
                  String(
                    (query.data.meta.page - 1) * query.data.meta.perPage + 1,
                  ),
                )
                .replace(
                  '{to}',
                  String(
                    Math.min(
                      query.data.meta.page * query.data.meta.perPage,
                      query.data.meta.total,
                    ),
                  ),
                )
                .replace('{total}', String(query.data.meta.total))}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="super-audit-page-prev"
                disabled={query.data.meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-[var(--border)] px-2 py-1 text-sm disabled:opacity-40"
                aria-label="Página anterior"
              >
                ←
              </button>
              <span aria-current="page">
                {query.data.meta.page} / {query.data.meta.totalPages}
              </span>
              <button
                type="button"
                data-testid="super-audit-page-next"
                disabled={
                  query.data.meta.page >= query.data.meta.totalPages
                }
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-[var(--border)] px-2 py-1 text-sm disabled:opacity-40"
                aria-label="Próxima página"
              >
                →
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
