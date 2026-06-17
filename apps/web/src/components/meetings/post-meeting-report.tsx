"use client";

import messages from "@/../messages/pt-BR.json";
import type { MeetingReportAttendee, PresenceType } from "@metanoia/types";
import { useMeetingReport } from "@/lib/api/hooks/use-meeting-report";
import { MeetingReportLeaderView } from "./meeting-report-leader-view";

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

  // FR63: full leader view
  if (data.meta.view === "full") {
    const fullData = data.data as import("@metanoia/types").MeetingLeaderReportResponse["data"];
    return <MeetingReportLeaderView meetingId={meetingId} data={fullData} />;
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

  // Should not reach here — 'full' and 'personal' are exhaustive
  return null;
}
