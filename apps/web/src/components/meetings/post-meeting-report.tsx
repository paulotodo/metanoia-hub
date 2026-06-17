"use client";

import messages from "@/../messages/pt-BR.json";
import type { MeetingReportAttendee, PresenceType } from "@metanoia/types";
import { useMeetingReport } from "@/lib/api/hooks/use-meeting-report";

export interface PostMeetingReportProps {
  meetingId: string;
}

const PRESENCE_LABEL: Record<PresenceType, string> = {
  integral: messages.postMeetingReport.presence.integral,
  parcial: messages.postMeetingReport.presence.parcial,
  ausente: messages.postMeetingReport.presence.ausente,
};

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return messages.postMeetingReport.minutes.replace("{minutes}", String(minutes));
}

function formatScore(score: number | null): string {
  if (score === null) return messages.postMeetingReport.noFocus;
  return `${Math.round(score * 100)}%`;
}

export function PostMeetingReport({ meetingId }: PostMeetingReportProps) {
  const t = messages.postMeetingReport;
  const { data, isLoading, isError } = useMeetingReport(meetingId);

  if (isLoading) {
    return (
      <p className="text-sm text-text-muted" data-testid="report-loading">
        {t.loading}
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-care-alert" data-testid="report-error">
        {t.error}
      </p>
    );
  }

  if (data.meta.view === "personal") {
    const personal = data.data as { attendee: MeetingReportAttendee };
    return (
      <section
        data-testid="post-meeting-report-personal"
        aria-labelledby="report-personal-heading"
        className="rounded-lg border border-border-default bg-surface-elevated p-4"
      >
        <h3
          id="report-personal-heading"
          className="text-base font-semibold text-text-primary"
        >
          {t.personalTitle}
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-text-muted">{t.table.presence}</dt>
            <dd className="font-medium">
              {PRESENCE_LABEL[personal.attendee.presenceType]}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">{t.table.duration}</dt>
            <dd>{formatMinutes(personal.attendee.durationSeconds)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">{t.table.camera}</dt>
            <dd>{formatMinutes(personal.attendee.cameraSeconds)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">{t.table.focus}</dt>
            <dd>{formatScore(personal.attendee.focusScore)}</dd>
          </div>
        </dl>
      </section>
    );
  }

  // Full view (lider/admin)
  const full = data.data as {
    summary: {
      attendees: MeetingReportAttendee[];
      totalDurationMinutes: number;
      avgEngagementScore: number | null;
      totalPresent: number;
      totalPartial: number;
      totalAbsent: number;
    };
  };
  const { summary } = full;

  return (
    <section
      data-testid="post-meeting-report-full"
      aria-labelledby="report-full-heading"
      className="space-y-4"
    >
      <h3
        id="report-full-heading"
        className="text-lg font-semibold text-text-primary"
      >
        {t.title}
      </h3>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-md border border-border-subtle p-3 text-sm">
          <dt className="text-text-muted">{t.metrics.duration}</dt>
          <dd className="text-base font-medium">{summary.totalDurationMinutes} min</dd>
        </div>
        <div className="rounded-md border border-border-subtle p-3 text-sm">
          <dt className="text-text-muted">{t.metrics.engagement}</dt>
          <dd className="text-base font-medium">
            {summary.avgEngagementScore === null
              ? t.noFocus
              : `${Math.round(summary.avgEngagementScore * 100)}%`}
          </dd>
        </div>
        <div className="rounded-md border border-border-subtle p-3 text-sm">
          <dt className="text-text-muted">{t.metrics.present}</dt>
          <dd className="text-base font-medium text-text-secondary">
            {summary.totalPresent}
          </dd>
        </div>
        <div className="rounded-md border border-border-subtle p-3 text-sm">
          <dt className="text-text-muted">{t.metrics.partial}</dt>
          <dd className="text-base font-medium text-text-secondary">
            {summary.totalPartial}
          </dd>
        </div>
        <div className="rounded-md border border-border-subtle p-3 text-sm">
          <dt className="text-text-muted">{t.metrics.absent}</dt>
          <dd className="text-base font-medium text-care-alert">
            {summary.totalAbsent}
          </dd>
        </div>
      </dl>

      <table
        className="w-full border-collapse text-sm"
        data-testid="post-meeting-report-table"
      >
        <thead>
          <tr className="border-b border-border-default text-text-muted">
            <th className="py-2 text-left">{t.table.name}</th>
            <th className="py-2 text-left">{t.table.presence}</th>
            <th className="py-2 text-left">{t.table.duration}</th>
            <th className="py-2 text-left">{t.table.camera}</th>
            <th className="py-2 text-left">{t.table.focus}</th>
          </tr>
        </thead>
        <tbody>
          {summary.attendees.map((a) => (
            <tr
              key={a.userId}
              className="border-b border-border-subtle"
              data-testid="post-meeting-report-row"
              data-user-id={a.userId}
            >
              <td className="py-2 truncate">{a.name ?? a.userId}</td>
              <td className="py-2">{PRESENCE_LABEL[a.presenceType]}</td>
              <td className="py-2">{formatMinutes(a.durationSeconds)}</td>
              <td className="py-2">{formatMinutes(a.cameraSeconds)}</td>
              <td className="py-2">{formatScore(a.focusScore)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
