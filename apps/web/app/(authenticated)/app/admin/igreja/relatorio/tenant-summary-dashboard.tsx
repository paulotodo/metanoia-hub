'use client';

import { useMemo, useState } from 'react';
import type { TenantSummaryQuery, TenantGroupMetrics } from '@metanoia/types';
import messages from '../../../../../../messages/pt-BR.json';
import { useTenantSummary } from '../../../../../../src/lib/api/hooks/use-tenant-report';
import { SemaforoBadge, type Semaforo } from './_components/semaforo-badge';
import { RefreshButton } from './_components/refresh-button';
import { TenantSummarySkeleton } from './_components/tenant-summary-skeleton';

const t = messages.tenantReport;

type PeriodOption = '7d' | '30d' | '90d';
type StatusFilter = '' | Semaforo;

function formatPercent(value: number | null): string {
  if (value === null) return t.table.notAvailable;
  return `${value.toFixed(1)}%`;
}

function formatDateTime(iso: string | null): string {
  if (iso === null) return t.meta.never;
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TenantSummaryDashboard() {
  const [period, setPeriod] = useState<PeriodOption>('30d');
  const [status, setStatus] = useState<StatusFilter>('');
  const [groupId, setGroupId] = useState<string>('');

  const query = useMemo<Partial<TenantSummaryQuery>>(
    () => ({
      period,
      ...(status ? { status } : {}),
      ...(groupId ? { groupId } : {}),
    }),
    [period, status, groupId],
  );

  const summaryQuery = useTenantSummary(query);

  if (summaryQuery.isPending) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <TenantSummarySkeleton />
      </main>
    );
  }

  if (summaryQuery.isError) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-text-danger" role="alert">
          {t.error.loading}
        </p>
        <button
          type="button"
          className="mt-4 text-sm underline"
          onClick={() => void summaryQuery.refetch()}
        >
          {t.error.retry}
        </button>
      </main>
    );
  }

  const { groups, summary } = summaryQuery.data.data;
  const meta = summaryQuery.data.meta;
  // Lista de grupos para o filtro (universo completo antes do filtro de status)
  const groupOptions = groups.map((g) => ({ id: g.groupId, name: g.groupName }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-display" data-autofocus>
            {t.title}
          </h1>
          <p className="text-body text-text-secondary">{t.subtitle}</p>
        </div>
        <RefreshButton />
      </header>

      {/* Indicador de atualização / stale */}
      <p className="mb-6 text-xs text-text-secondary">
        {t.meta.lastRefresh.replace('{when}', formatDateTime(meta.lastRefreshAt))}
        {meta.stale && (
          <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            {t.meta.stale}
          </span>
        )}
      </p>

      {/* Filtros (navegáveis por teclado, labels associados) */}
      <section aria-labelledby="filters-heading" className="mb-8">
        <h2 id="filters-heading" className="sr-only">
          {t.filters.heading}
        </h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-period" className="text-xs font-medium text-text-secondary">
              {t.filters.period}
            </label>
            <select
              id="filter-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodOption)}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <option value="7d">{t.filters.period7d}</option>
              <option value="30d">{t.filters.period30d}</option>
              <option value="90d">{t.filters.period90d}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-group" className="text-xs font-medium text-text-secondary">
              {t.filters.group}
            </label>
            <select
              id="filter-group"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <option value="">{t.filters.allGroups}</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs font-medium text-text-secondary">
              {t.filters.status}
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <option value="">{t.filters.allStatus}</option>
              <option value="verde">{t.semaforo.verde}</option>
              <option value="amarelo">{t.semaforo.amarelo}</option>
              <option value="vermelho">{t.semaforo.vermelho}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Totais consolidados */}
      <section aria-labelledby="summary-heading" className="mb-10">
        <h2 id="summary-heading" className="text-heading mb-4">
          {t.summary.heading}
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SummaryStat label={t.summary.totalGroups} value={String(summary.totalGroups)} />
          <SummaryStat label={t.summary.totalLeaders} value={String(summary.totalLeaders)} />
          <SummaryStat label={t.summary.totalParticipants} value={String(summary.totalParticipants)} />
          <SummaryStat label={t.summary.attendance} value={formatPercent(summary.overallAttendancePercent)} />
          <SummaryStat label={t.summary.trailProgress} value={formatPercent(summary.overallTrailProgressPercent)} />
          <SummaryStat label={t.summary.riskCount} value={String(summary.totalRiskCount)} />
        </dl>
      </section>

      {/* Tabela de grupos — região com aria-live para anunciar atualizações */}
      <section aria-labelledby="groups-heading">
        <h2 id="groups-heading" className="text-heading mb-4">
          {t.table.heading}
        </h2>
        <div aria-live="polite" aria-busy={summaryQuery.isFetching}>
          {groups.length === 0 ? (
            <p className="text-body text-text-secondary">{t.table.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t.table.caption}</caption>
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th scope="col" className="py-2 pr-4">{t.table.group}</th>
                    <th scope="col" className="py-2 pr-4">{t.table.leader}</th>
                    <th scope="col" className="py-2 pr-4">{t.table.attendance}</th>
                    <th scope="col" className="py-2 pr-4">{t.table.trailProgress}</th>
                    <th scope="col" className="py-2 pr-4">{t.table.participants}</th>
                    <th scope="col" className="py-2 pr-4">{t.table.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g: TenantGroupMetrics) => (
                    <tr key={g.groupId} className="border-b border-border/50">
                      <th scope="row" className="py-2 pr-4 font-medium text-text-primary">
                        {g.groupName}
                      </th>
                      <td className="py-2 pr-4">{g.leaderName ?? t.table.noLeader}</td>
                      <td className="py-2 pr-4">{formatPercent(g.attendanceAvgPercent)}</td>
                      <td className="py-2 pr-4">{formatPercent(g.trailProgressAvgPercent)}</td>
                      <td className="py-2 pr-4">{g.activeParticipants}</td>
                      <td className="py-2 pr-4">
                        <SemaforoBadge status={g.semaforo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="text-heading font-semibold text-text-primary">{value}</dd>
    </div>
  );
}
