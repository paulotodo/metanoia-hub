"use client";

import type { MeetingResponse, MeetingStatus } from "@metanoia/types";

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Agendada",
  live: "Em andamento",
  ended: "Encerrada",
  cancelled: "Cancelada",
};

const STATUS_TONE: Record<MeetingStatus, string> = {
  scheduled: "bg-care-info/10 text-care-info",
  live: "bg-care-ok/10 text-care-ok",
  ended: "bg-text-muted/10 text-text-muted",
  cancelled: "bg-care-alert/10 text-care-alert",
};

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(d);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
  return { date, time };
}

export interface MeetingCardProps {
  meeting: MeetingResponse;
  onJoin?: (meetingId: string) => void;
  isJoining?: boolean;
}

/**
 * MeetingCard — UX-DR13 reference. Pastoral vocabulary, 1-tap entry button.
 * Story 5.1: the entry button calls the `/meetings/:id/join` endpoint via the
 * `onJoin` callback (parent owns the mutation + redirect).
 */
export function MeetingCard({ meeting, onJoin, isJoining = false }: MeetingCardProps) {
  const { date, time } = formatDateTime(meeting.scheduledFor);
  const status = meeting.status;
  const canJoin = status === "live";
  const title = meeting.title ?? meeting.topic ?? "Reunião do grupo";

  return (
    <article
      data-testid="meeting-card"
      className="rounded-lg border border-border-default bg-surface-elevated p-4 shadow-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-text-primary">
            {title}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {date} · {time}
            {meeting.durationMinutes
              ? ` · ${meeting.durationMinutes} min`
              : ""}
          </p>
        </div>
        <span
          data-testid="meeting-card-status"
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </header>

      {canJoin && onJoin ? (
        <button
          type="button"
          data-testid="meeting-card-join"
          onClick={() => onJoin(meeting.id)}
          disabled={isJoining}
          className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-care-ok px-3 py-2 text-sm font-medium text-white shadow hover:bg-care-ok/90 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Entrar na reunião"
        >
          {isJoining ? "Entrando..." : "Entrar agora"}
        </button>
      ) : null}
    </article>
  );
}
