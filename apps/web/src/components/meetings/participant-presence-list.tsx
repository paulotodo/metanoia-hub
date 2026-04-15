"use client";

import { useId, useMemo } from "react";
import type { MeetingParticipant } from "@metanoia/types";

interface ParticipantPresenceListProps {
  participants: MeetingParticipant[];
  label: string;
  connectedLabel: string;
  notJoinedLabel: string;
  leftLabel: string;
  waitingLabel: string;
}

type PresenceState = "connected" | "left" | "not-joined";

function presenceState(p: MeetingParticipant): PresenceState {
  if (p.joinedAt && !p.leftAt) return "connected";
  if (p.joinedAt && p.leftAt) return "left";
  return "not-joined";
}

function sortKey(state: PresenceState): number {
  if (state === "connected") return 0;
  if (state === "left") return 1;
  return 2;
}

export function ParticipantPresenceList({
  participants,
  label,
  connectedLabel,
  notJoinedLabel,
  leftLabel,
  waitingLabel,
}: ParticipantPresenceListProps) {
  const labelId = useId();

  const { sorted, connectedCount } = useMemo(() => {
    let count = 0;
    const copy = [...participants];
    for (const p of copy) {
      if (presenceState(p) === "connected") count++;
    }
    copy.sort(
      (a, b) =>
        sortKey(presenceState(a)) - sortKey(presenceState(b)) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
    return { sorted: copy, connectedCount: count };
  }, [participants]);

  return (
    <section
      aria-labelledby={labelId}
      className="space-y-3"
      data-testid="participant-presence-list"
    >
      <div className="flex items-center justify-between">
        <h3 id={labelId} className="text-sm font-medium text-text-secondary">
          {label}
        </h3>
        <span
          className="text-xs font-medium text-text-muted"
          data-testid="participant-count"
        >
          {connectedCount}
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-text-muted">{waitingLabel}</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((p) => {
            const state = presenceState(p);
            const dotClass =
              state === "connected"
                ? "bg-care-ok"
                : state === "left"
                  ? "bg-text-muted"
                  : "border border-text-muted bg-transparent";
            const stateLabel =
              state === "connected"
                ? connectedLabel
                : state === "left"
                  ? leftLabel
                  : notJoinedLabel;
            return (
              <li
                key={p.participantId}
                data-state={state}
                className="flex items-center justify-between rounded-lg border border-surface-muted px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`}
                  />
                  <span className="text-sm text-text-primary">{p.name}</span>
                </div>
                <span className="text-xs text-text-secondary">{stateLabel}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
