'use client';

import type { LeaderGroupMetrics } from '@metanoia/types';

interface AtRiskBadgeProps {
  count: number;
  t: { label: string; zero: string };
}

/**
 * AtRiskBadge — semáforo badge with icon+text (WCAG 1.4.1, NFR-A3).
 * Uses color AND icon/text to communicate status (never color alone).
 * Contrast: text-[var(--color-text-secondary)] via token (NEVER text-muted).
 */
function AtRiskBadge({ count, t }: AtRiskBadgeProps) {
  if (count === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[var(--color-care-ok)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--color-care-ok)]"
        aria-label={t.zero}
      >
        {/* Icon: checkmark */}
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        <span>{t.zero}</span>
      </span>
    );
  }

  const isUrgent = count >= 3;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isUrgent
          ? 'bg-[var(--color-care-urgent)]/10 text-[var(--color-care-urgent)]'
          : 'bg-[var(--color-care-attention)]/10 text-[var(--color-care-attention)]'
      }`}
      aria-label={`${count} ${t.label}`}
    >
      {/* Icon: warning triangle */}
      <svg
        aria-hidden="true"
        focusable="false"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
        />
      </svg>
      <span>
        {count} {t.label}
      </span>
    </span>
  );
}

interface GroupSummaryCardProps {
  group: LeaderGroupMetrics;
  t: {
    attendance: string;
    trailProgress: string;
    atRisk: string;
    atRiskZero: string;
    participants: string;
    noMeetings: string;
  };
}

/**
 * GroupSummaryCard — pastoral metrics card per group.
 *
 * a11y:
 * - Uses article + aria-label for screen reader identification.
 * - All metric labels are visible text (not tooltip-only).
 * - AtRiskBadge uses icon+text (color is supplementary).
 * - Contrast: --color-text-secondary token (WCAG AA guaranteed).
 */
export function GroupSummaryCard({ group, t }: GroupSummaryCardProps) {
  return (
    <article
      aria-label={group.groupName}
      className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
    >
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-snug">
          {group.groupName}
        </h3>
        <AtRiskBadge
          count={group.atRiskCount}
          t={{ label: t.atRisk, zero: t.atRiskZero }}
        />
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Active participants */}
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-[var(--color-text-secondary)]">{t.participants}</dt>
          <dd
            className="text-xl font-bold text-[var(--color-text-primary)] tabular-nums"
            aria-label={`${group.activeParticipantsCount} ${t.participants}`}
          >
            {group.activeParticipantsCount}
          </dd>
        </div>

        {/* Attendance */}
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-[var(--color-text-secondary)]">{t.attendance}</dt>
          <dd
            className="text-xl font-bold text-[var(--color-text-primary)] tabular-nums"
            aria-label={
              group.avgAttendancePercent !== null
                ? `${formatPct(group.avgAttendancePercent)} ${t.attendance}`
                : t.noMeetings
            }
          >
            {group.avgAttendancePercent !== null ? formatPct(group.avgAttendancePercent) : '—'}
          </dd>
          {group.avgAttendancePercent === null && (
            <dd className="text-xs text-[var(--color-text-secondary)]">{t.noMeetings}</dd>
          )}
        </div>

        {/* Trail progress */}
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-[var(--color-text-secondary)]">{t.trailProgress}</dt>
          <dd
            className="text-xl font-bold text-[var(--color-text-primary)] tabular-nums"
            aria-label={`${formatPct(group.avgTrailProgressPercent)} ${t.trailProgress}`}
          >
            {formatPct(group.avgTrailProgressPercent)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function formatPct(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
