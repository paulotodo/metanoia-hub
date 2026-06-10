"use client";

import { HandHeart, Users } from "lucide-react";
import {
  PASTORAL_TIMELINE_EMPTY_TITLE,
  PASTORAL_TIMELINE_EMPTY_MESSAGE,
  PASTORAL_CARE_HISTORY_LABEL,
} from "@metanoia/types";
import type { ParticipantTimelineEvent } from "@metanoia/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} semana${Math.floor(days / 7) > 1 ? "s" : ""}`;
  if (days < 365) return `há ${Math.floor(days / 30)} mês${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `há ${Math.floor(days / 365)} ano${Math.floor(days / 365) > 1 ? "s" : ""}`;
}

function presenceTypeLabel(presenceType: string | null): string {
  switch (presenceType) {
    case "present":
      return "Presente";
    case "absent":
      return "Ausente";
    case "no-meeting":
      return "Sem reunião";
    default:
      return "Reunião";
  }
}

function actionTypeLabel(actionType: string | null): string {
  switch (actionType) {
    case "message":
      return "Mensagem";
    case "call":
      return "Ligação";
    case "visit":
      return "Visita";
    case "prayer":
      return "Oração";
    default:
      return "Ação pastoral";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TimelineEventItem({ event }: { event: ParticipantTimelineEvent }) {
  const isAction = event.eventType === "action";

  return (
    <li className="relative flex gap-3">
      {/* Timeline indicator */}
      <span
        className={`mt-1 flex size-7 shrink-0 items-center justify-center rounded-full ${
          isAction
            ? "bg-brand-teal/10 text-brand-teal"
            : "bg-surface-elevated text-text-muted"
        }`}
        aria-hidden="true"
      >
        {isAction ? (
          <HandHeart className="size-3.5" />
        ) : (
          <Users className="size-3.5" />
        )}
      </span>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-text-primary">
            {isAction
              ? actionTypeLabel(event.actionType)
              : presenceTypeLabel(event.presenceType)}
          </p>
          <time
            dateTime={event.occurredAt}
            className="shrink-0 text-xs text-text-muted"
          >
            {formatRelativeDate(event.occurredAt)}
          </time>
        </div>
        {event.note && (
          <p className="text-sm text-text-secondary line-clamp-3">
            {event.note}
          </p>
        )}
      </div>
    </li>
  );
}

function EmptyTimelineState() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg bg-surface-sunken px-4 py-8 text-center"
      data-testid="timeline-empty-state"
    >
      <HandHeart className="size-8 text-text-muted" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-text-secondary">
          {PASTORAL_TIMELINE_EMPTY_TITLE}
        </p>
        <p className="text-sm text-text-muted">
          {PASTORAL_TIMELINE_EMPTY_MESSAGE}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TimelineCuidadoProps {
  events: ParticipantTimelineEvent[];
}

/**
 * TimelineCuidado — merged individual timeline for a participant.
 * Shows presence signals and pastoral care actions in reverse chronological order.
 * Story 6-4.
 */
export function TimelineCuidado({ events }: TimelineCuidadoProps) {
  return (
    <section
      className="space-y-3"
      aria-labelledby="timeline-cuidado-heading"
      data-testid="timeline-cuidado"
    >
      <h2
        id="timeline-cuidado-heading"
        className="text-sm font-semibold text-text-secondary"
      >
        {PASTORAL_CARE_HISTORY_LABEL}
      </h2>

      {events.length === 0 ? (
        <EmptyTimelineState />
      ) : (
        <ul className="space-y-0" aria-label={PASTORAL_CARE_HISTORY_LABEL}>
          {events.map((event) => (
            <TimelineEventItem key={event.id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}
