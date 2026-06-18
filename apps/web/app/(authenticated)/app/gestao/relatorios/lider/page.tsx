'use client';

import { useState } from 'react';
import type { LeaderSummaryQuery } from '@metanoia/types';
import { useLeaderSummary } from '@/lib/api/hooks/use-leader-summary';
import { LeaderSummaryFilters } from './_components/leader-summary-filters';
import { GroupSummaryCard } from './_components/group-summary-card';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.leaderReport;

const PERIOD_OPTIONS: Record<LeaderSummaryQuery['period'], string> = {
  '7d': t.filters.period7d,
  '30d': t.filters.period30d,
  '90d': t.filters.period90d,
  custom: t.filters.periodCustom,
};

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/**
 * /app/gestao/relatorios/lider — Relatório Consolidado por Líder (FR79)
 *
 * Client Component: fetches via useLeaderSummary (TanStack Query).
 * Server Components use native fetch — not applicable here (auth area + interactive filters).
 *
 * a11y:
 * - Page heading h1 with role=main.
 * - Loading: aria-busy + sr-only text.
 * - Groups rendered as <section> with aria-label.
 * - NOT added to a11y-pages.json (authenticated page, tech debt R2).
 */
export default function LeaderReportPage() {
  const [period, setPeriod] = useState<LeaderSummaryQuery['period']>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);

  const query: Partial<LeaderSummaryQuery> = {
    period,
    ...(period === 'custom' && startDate && endDate ? { startDate, endDate } : {}),
    ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
  };

  const { data, isLoading, error } = useLeaderSummary(query);

  const groups = data?.data.groups ?? [];
  const summary = data?.data.summary;

  // Derive group list for the filter (all loaded groups — allows filter to show even if groupId is set)
  const allGroupsForFilter = groups.map((g) => ({
    groupId: g.groupId,
    groupName: g.groupName,
  }));

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-6">
      {/* Page header */}
      <header className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{t.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.subtitle}</p>
      </header>

      {/* Filters */}
      <LeaderSummaryFilters
        period={period}
        startDate={startDate}
        endDate={endDate}
        groupId={selectedGroupId}
        groups={allGroupsForFilter}
        onPeriodChange={(p) => {
          setPeriod(p);
          if (p !== 'custom') {
            setStartDate('');
            setEndDate('');
          }
        }}
        onDateRangeChange={(s, e) => {
          setStartDate(s);
          setEndDate(e);
        }}
        onGroupChange={setSelectedGroupId}
        t={{
          period: t.filters.period,
          periodOptions: PERIOD_OPTIONS,
          allGroups: t.filters.allGroups,
          startDate: t.filters.startDate,
          endDate: t.filters.endDate,
          filterLabel: t.filters.filterLabel,
        }}
      />

      {/* Summary metrics */}
      {summary && (
        <section
          aria-label={t.summary.label}
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <span className="text-xs text-[var(--color-text-secondary)]">{t.summary.totalGroups}</span>
            <span
              className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums"
              aria-label={`${summary.totalGroups} ${t.summary.totalGroups}`}
            >
              {summary.totalGroups}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <span className="text-xs text-[var(--color-text-secondary)]">{t.summary.totalParticipants}</span>
            <span
              className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums"
              aria-label={`${summary.totalParticipants} ${t.summary.totalParticipants}`}
            >
              {summary.totalParticipants}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <span className="text-xs text-[var(--color-text-secondary)]">{t.summary.attendance}</span>
            <span
              className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums"
              aria-label={`${formatPct(summary.overallAttendancePercent)} ${t.summary.attendance}`}
            >
              {formatPct(summary.overallAttendancePercent)}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <span className="text-xs text-[var(--color-text-secondary)]">{t.summary.trailCompletion}</span>
            <span
              className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums"
              aria-label={`${formatPct(summary.overallTrailCompletionPercent)} ${t.summary.trailCompletion}`}
            >
              {formatPct(summary.overallTrailCompletionPercent)}
            </span>
          </div>
        </section>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          role="status"
          aria-busy="true"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <span className="sr-only">{t.loading}</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-[var(--color-border)] motion-safe:animate-pulse bg-[var(--color-surface-muted)]"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-4"
        >
          <p className="text-sm text-[var(--color-danger)]" data-testid="leader-report-error">
            {t.error}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && groups.length === 0 && (
        <p
          className="mt-10 text-center text-sm text-[var(--color-text-secondary)]"
          data-testid="leader-report-empty"
        >
          {t.empty}
        </p>
      )}

      {/* Groups grid */}
      {!isLoading && !error && groups.length > 0 && (
        <section
          aria-label={t.groupsLabel}
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {groups.map((group) => (
            <GroupSummaryCard
              key={group.groupId}
              group={group}
              t={{
                attendance: t.card.attendance,
                trailProgress: t.card.trailProgress,
                atRisk: t.card.atRisk,
                atRiskZero: t.card.atRiskZero,
                participants: t.card.participants,
                noMeetings: t.card.noMeetings,
              }}
            />
          ))}
        </section>
      )}
    </main>
  );
}
