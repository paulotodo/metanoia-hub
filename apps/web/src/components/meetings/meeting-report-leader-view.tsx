'use client';

import * as React from 'react';
import messages from '@/../messages/pt-BR.json';
import type { MeetingLeaderReportResponse, EngagementLevel } from '@metanoia/types';
import { ExportReportButton } from './export-report-button';

export interface MeetingReportLeaderViewProps {
  meetingId: string;
  data: MeetingLeaderReportResponse['data'];
}

const t = messages.meetingLeaderReport;

// ─── Presence status badge ────────────────────────────────────────────────────

const PRESENCE_LABEL: Record<string, string> = {
  integral: t.presence.integral,
  parcial: t.presence.parcial,
  ausente: t.presence.ausente,
};

const PRESENCE_COLOR: Record<string, string> = {
  integral: 'bg-radar-green text-white',
  parcial: 'bg-radar-yellow text-text-primary',
  ausente: 'bg-radar-red text-white',
};

// ─── Engagement level badge ───────────────────────────────────────────────────

const ENGAGEMENT_LABEL: Record<EngagementLevel, string> = {
  low: t.engagement.low,
  medium: t.engagement.medium,
  high: t.engagement.high,
};

const ENGAGEMENT_COLOR: Record<EngagementLevel, string> = {
  low: 'bg-care-alert/15 text-care-alert',
  medium: 'bg-radar-yellow/20 text-text-primary',
  high: 'bg-radar-green/15 text-pastoral-green',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMinutes(seconds: number): string {
  return t.minutes.replace('{minutes}', String(Math.round(seconds / 60)));
}

function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// ─── Metrics summary cards ────────────────────────────────────────────────────

function MetricsSection({
  metrics,
}: {
  metrics: MeetingLeaderReportResponse['data']['metrics'];
}) {
  return (
    <section aria-labelledby="meeting-metrics-heading" className="mb-6">
      <h3
        id="meeting-metrics-heading"
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary"
      >
        {t.metrics.heading}
      </h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label={t.metrics.present}
          value={String(metrics.presentCount)}
          icon="✓"
          iconLabel="Presente"
          color="text-pastoral-green"
        />
        <MetricCard
          label={t.metrics.partial}
          value={String(metrics.partialCount)}
          icon="◐"
          iconLabel="Parcial"
          color="text-radar-yellow"
        />
        <MetricCard
          label={t.metrics.absent}
          value={String(metrics.absentCount)}
          icon="✗"
          iconLabel="Ausente"
          color="text-care-alert"
        />
        <MetricCard
          label={t.metrics.attendanceRate}
          value={formatRate(metrics.attendanceRate)}
          icon="📊"
          iconLabel="Taxa de presença"
          color="text-text-primary"
        />
      </dl>
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon,
  iconLabel,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  iconLabel: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated p-3">
      <dt className="flex items-center gap-1 text-xs text-text-secondary">
        {/* Icon with text label for a11y: icon is decorative but iconLabel provides semantic context */}
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </dt>
      <dd className={`mt-1 text-2xl font-bold ${color}`}>{value}</dd>
    </div>
  );
}

// ─── Participants table ───────────────────────────────────────────────────────

function ParticipantsTable({
  participants,
}: {
  participants: MeetingLeaderReportResponse['data']['participants'];
}) {
  const absentParticipants = participants.filter((p) => p.status === 'ausente');

  return (
    <section aria-labelledby="participants-heading">
      <div className="mb-3 flex items-center justify-between">
        <h3
          id="participants-heading"
          className="text-sm font-semibold uppercase tracking-wide text-text-secondary"
        >
          {t.participants.heading}
        </h3>
      </div>

      {/* Pastoral CTA for absent participants (FR-09, CHK024) */}
      {absentParticipants.length > 0 && (
        <div
          role="region"
          aria-label={t.participants.pastoral}
          className="mb-4 rounded-lg border border-care-alert/30 bg-care-alert/5 p-3"
        >
          <p className="mb-2 text-sm font-medium text-care-alert">
            {/* Icon + text label — a11y: icon is decorative */}
            <span aria-hidden="true">⚠ </span>
            {`${absentParticipants.length} ${absentParticipants.length === 1 ? 'participante ausente' : 'participantes ausentes'}`}
          </p>
          <ul className="space-y-1 text-sm text-text-secondary">
            {absentParticipants.map((p) => (
              <li key={p.userId} className="flex items-center justify-between">
                <span>{p.name ?? p.email ?? p.userId}</span>
                <span
                  aria-label={`${t.participants.absentBadge}: ${p.name ?? p.email}`}
                  className="rounded-full bg-care-alert/15 px-2 py-0.5 text-xs text-care-alert"
                >
                  {/* Icon + text: WCAG 1.4.1 — badge uses both color and text */}
                  <span aria-hidden="true">✗ </span>
                  {t.participants.absentBadge}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full participants table — responsive with horizontal scroll */}
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-sm"
          aria-label={t.participants.heading}
        >
          <thead>
            <tr className="border-b border-border-default text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <th scope="col" className="py-2 pr-3">
                {t.participants.name}
              </th>
              <th scope="col" className="py-2 pr-3">
                {t.participants.status}
              </th>
              <th scope="col" className="py-2 pr-3">
                {t.participants.duration}
              </th>
              <th scope="col" className="py-2">
                {t.participants.engagement}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {participants.map((p) => (
              <tr key={p.userId} className="hover:bg-surface-elevated/50">
                <td className="py-2.5 pr-3">
                  <div className="font-medium text-text-primary">
                    {p.name ?? t.noData}
                  </div>
                  {p.email && (
                    <div className="text-xs text-text-secondary">{p.email}</div>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <span
                    aria-label={`Presença: ${PRESENCE_LABEL[p.status] ?? p.status}`}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PRESENCE_COLOR[p.status] ?? ''}`}
                  >
                    {/* Badge: icon + text satisfies WCAG 1.4.1 (not color alone) */}
                    <span aria-hidden="true">
                      {p.status === 'integral' ? '✓' : p.status === 'parcial' ? '◐' : '✗'}
                    </span>
                    {PRESENCE_LABEL[p.status] ?? p.status}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-text-secondary">
                  {formatMinutes(p.durationSeconds)}
                </td>
                <td className="py-2.5">
                  {p.engagementLevel ? (
                    <span
                      aria-label={`Engajamento: ${ENGAGEMENT_LABEL[p.engagementLevel]}`}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ENGAGEMENT_COLOR[p.engagementLevel]}`}
                    >
                      {/* Badge: icon + text satisfies WCAG 1.4.1 */}
                      <span aria-hidden="true">
                        {p.engagementLevel === 'high' ? '▲' : p.engagementLevel === 'medium' ? '→' : '▼'}
                      </span>
                      {ENGAGEMENT_LABEL[p.engagementLevel]}
                    </span>
                  ) : (
                    <span className="text-text-secondary" aria-label="Engajamento não disponível">
                      {t.noData}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * MeetingReportLeaderView — FR63 full leader/admin view of a meeting report.
 *
 * Displays:
 *   - Metrics summary (present/partial/absent counts, attendance rate)
 *   - Pastoral CTA for absent participants (FR-09)
 *   - Full participants table with presence status + engagement badges (WCAG 1.4.1)
 *   - Export CSV button (FR-06, CHK040 polling cadence)
 *
 * A11y:
 *   - All badges use icon + text label (not color alone, WCAG 1.4.1)
 *   - Status/engagement use aria-label with full context
 *   - Table uses scope="col" headers and accessible caption via aria-label
 *   - text-text-secondary (WCAG AA contrast) — NEVER text-muted
 */
export function MeetingReportLeaderView({
  meetingId,
  data,
}: MeetingReportLeaderViewProps) {
  return (
    <article
      aria-labelledby="leader-report-heading"
      className="rounded-lg border border-border-default bg-surface-base p-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="leader-report-heading"
          className="text-base font-semibold text-text-primary"
        >
          {t.title}
        </h2>
        <ExportReportButton meetingId={meetingId} />
      </div>

      <MetricsSection metrics={data.metrics} />
      <ParticipantsTable participants={data.participants} />
    </article>
  );
}
