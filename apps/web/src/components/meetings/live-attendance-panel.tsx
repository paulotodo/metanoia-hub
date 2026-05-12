"use client";

import messages from "@/../messages/pt-BR.json";
import { useAttendanceLive } from "@/hooks/use-attendance-live";

export interface LiveAttendancePanelProps {
  meetingId: string;
}

/**
 * Story 5.5 — Líder/Admin-only panel showing the live attendance list via
 * SSE. Server-side authorization is enforced by `MeetingRoleGuard`; if the
 * user lacks permission, the stream returns 403 and the panel rolls into
 * the error state.
 */
export function LiveAttendancePanel({ meetingId }: LiveAttendancePanelProps) {
  const state = useAttendanceLive(meetingId);
  const t = messages.meetingTransparency.live;

  return (
    <section
      data-testid="live-attendance-panel"
      aria-labelledby="live-attendance-heading"
      className="rounded-lg border border-border-default bg-surface-elevated p-4"
    >
      <h3
        id="live-attendance-heading"
        className="text-base font-semibold text-text-primary"
      >
        {t.title}
      </h3>

      {state.status === "error" ? (
        <p
          className="mt-2 text-sm text-care-alert"
          data-testid="live-attendance-error"
        >
          {t.error}
        </p>
      ) : null}

      {state.participants.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">{t.empty}</p>
      ) : (
        <ul
          className="mt-3 space-y-2"
          data-testid="live-attendance-list"
        >
          {state.participants.map((p) => (
            <li
              key={p.userId}
              className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2 text-sm"
              data-testid="live-attendance-row"
              data-user-id={p.userId}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">
                  {p.name ?? p.userId}
                </p>
                <p className="text-xs text-text-muted">
                  {p.status === "na-sala" ? t.status.naSala : t.status.saiu} ·{" "}
                  {p.cameraOn ? t.camera.on : t.camera.off}
                </p>
              </div>
              <span className="text-xs text-text-secondary">
                {Math.round(p.currentDurationSeconds / 60)}m
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
