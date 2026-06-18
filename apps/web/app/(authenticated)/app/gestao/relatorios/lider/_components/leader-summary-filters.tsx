'use client';

import { useId } from 'react';
import type { LeaderSummaryQuery, LeaderGroupMetrics } from '@metanoia/types';

interface LeaderSummaryFiltersProps {
  period: LeaderSummaryQuery['period'];
  startDate?: string;
  endDate?: string;
  groupId?: string;
  groups: Pick<LeaderGroupMetrics, 'groupId' | 'groupName'>[];
  onPeriodChange: (period: LeaderSummaryQuery['period']) => void;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  onGroupChange: (groupId: string | undefined) => void;
  t: {
    period: string;
    periodOptions: Record<string, string>;
    allGroups: string;
    startDate: string;
    endDate: string;
    filterLabel: string;
  };
}

/**
 * LeaderSummaryFilters — accessible period + group filter panel.
 *
 * Uses FormField pattern from Story 12.5 (accessible form fields).
 * a11y: all selects have <label>, date inputs have aria-label.
 */
export function LeaderSummaryFilters({
  period,
  startDate = '',
  endDate = '',
  groupId,
  groups,
  onPeriodChange,
  onDateRangeChange,
  onGroupChange,
  t,
}: LeaderSummaryFiltersProps) {
  const periodId = useId();
  const groupId2 = useId();
  const startId = useId();
  const endId = useId();

  return (
    <section
      aria-label={t.filterLabel}
      className="flex flex-wrap gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      {/* Period selector */}
      <div className="flex min-w-[160px] flex-col gap-1">
        <label
          htmlFor={periodId}
          className="text-xs font-medium text-[var(--color-text-secondary)]"
        >
          {t.period}
        </label>
        <select
          id={periodId}
          value={period}
          onChange={(e) => onPeriodChange(e.target.value as LeaderSummaryQuery['period'])}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          {Object.entries(t.periodOptions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Group filter */}
      {groups.length > 0 && (
        <div className="flex min-w-[200px] flex-col gap-1">
          <label
            htmlFor={groupId2}
            className="text-xs font-medium text-[var(--color-text-secondary)]"
          >
            {t.allGroups}
          </label>
          <select
            id={groupId2}
            value={groupId ?? ''}
            onChange={(e) => onGroupChange(e.target.value || undefined)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="">{t.allGroups}</option>
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.groupName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={startId}
              className="text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {t.startDate}
            </label>
            <input
              id={startId}
              type="date"
              value={startDate.slice(0, 10)}
              onChange={(e) =>
                onDateRangeChange(
                  e.target.value ? `${e.target.value}T00:00:00.000Z` : '',
                  endDate,
                )
              }
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={endId}
              className="text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {t.endDate}
            </label>
            <input
              id={endId}
              type="date"
              value={endDate.slice(0, 10)}
              onChange={(e) =>
                onDateRangeChange(
                  startDate,
                  e.target.value ? `${e.target.value}T23:59:59.999Z` : '',
                )
              }
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>
      )}
    </section>
  );
}
