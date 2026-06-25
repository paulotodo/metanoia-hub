"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { cn } from "@metanoia/ui";
import { ChevronDown } from "lucide-react";
import type { SignalType } from "@metanoia/types";
import type { RadarParticipant } from "../../../../../../__mocks__/radar";
import { RiskReasonBadge } from "./risk-reason-badge";

// --- AC-1 (RF-01): Status labels for screen readers (non-color-only) ---
// clarify C1 (dec-009), C2 (dec-008): care-urgent="Urgente", care-attention="Atenção necessária", care-ok="Bem"
const STATUS_LABEL: Record<SignalType, string> = {
  "care-urgent": "Urgente",
  "care-attention": "Atenção necessária",
  "care-ok": "Bem",
};

// --- Expanded Card (care-urgent) ---

function ParticipantCardExpanded({
  participant,
}: {
  participant: RadarParticipant;
}) {
  // AC-1: aria-label conveys name + status so AT announces both without relying on color
  const ariaLabel = `${participant.name} — ${STATUS_LABEL[participant.signalType]}`;

  return (
    <div
      aria-label={ariaLabel}
      className="group rounded-lg border-l-4 border-l-care-urgent border border-border-default bg-surface-elevated p-4 motion-safe:transition-transform active:scale-[0.98]"
    >
      <Link
        href={`/app/gestao/radar/${participant.participantId}`}
        className="block"
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-text-primary">
              {participant.name}
            </h3>
            {participant.contextPhrase && (
              <p className="mt-1 text-sm text-text-secondary lg:text-base">
                {participant.contextPhrase}
              </p>
            )}
            <span className="mt-1 inline-block text-xs text-text-muted">
              {participant.groupName}
            </span>
            {participant.riskReason && (
              <div className="mt-2" aria-live="polite">
                <RiskReasonBadge riskReason={participant.riskReason} />
              </div>
            )}
          </div>
        </div>
      </Link>
      <div className="mt-3 flex justify-end">
        <Link
          href={`/app/gestao/radar/${participant.participantId}/cuidado`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md bg-brand-teal px-3 py-1.5 text-sm font-medium text-text-inverse motion-safe:transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
        >
          Registrar cuidado
        </Link>
      </div>
    </div>
  );
}

// --- Medium Card (care-attention) ---

function ParticipantCardMedium({
  participant,
}: {
  participant: RadarParticipant;
}) {
  // AC-1: aria-label on the Link root conveys name + status (label hides children from AT)
  const ariaLabel = `${participant.name} — ${STATUS_LABEL[participant.signalType]}`;

  return (
    <Link
      href={`/app/gestao/radar/${participant.participantId}`}
      aria-label={ariaLabel}
      className="group block rounded-lg border-l-4 border-l-care-attention border border-border-default bg-surface-elevated p-4 motion-safe:transition-transform active:scale-[0.98]"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text-primary">
            {participant.name}
          </h3>
          {participant.contextPhrase && (
            <p className="mt-0.5 text-sm text-text-secondary">
              {participant.contextPhrase}
            </p>
          )}
          {participant.riskReason && (
            <div className="mt-1.5" aria-live="polite">
              <RiskReasonBadge riskReason={participant.riskReason} />
            </div>
          )}
        </div>
        <span className="shrink-0 text-sm font-medium text-brand-teal" aria-hidden="true">
          Ver
        </span>
      </div>
    </Link>
  );
}

// --- Compact Card (care-ok) ---

function ParticipantCardCompact({
  participants,
}: {
  participants: RadarParticipant[];
}) {
  const [expanded, setExpanded] = useState(false);
  // AC-2 (RF-02): aria-controls links button to the panel it controls
  const panelId = useId();
  const maxInline = 3;
  const overflow = participants.length - maxInline;

  if (participants.length === 0) return null;

  const inlineNames = participants.slice(0, maxInline).map((p) => p.name);
  const inlineText =
    overflow > 0
      ? `${inlineNames.join(" · ")} · +${overflow}`
      : inlineNames.join(" · ");

  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between px-4 py-3 text-left motion-safe:transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-interactive-focus"
      >
        <span className="text-sm text-text-secondary">{inlineText}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-text-muted motion-safe:transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <ul id={panelId} className="border-t border-border-default px-4 py-2">
          {participants.map((p) => (
            <li
              key={p.participantId}
              className="py-1.5 text-sm text-text-secondary"
            >
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Main Export ---

interface ParticipantCardProps {
  participant: RadarParticipant;
}

export function ParticipantCard({ participant }: ParticipantCardProps) {
  switch (participant.signalType) {
    case "care-urgent":
      return <ParticipantCardExpanded participant={participant} />;
    case "care-attention":
      return <ParticipantCardMedium participant={participant} />;
    case "care-ok":
      return null; // care-ok uses CompactList
  }
}

export { ParticipantCardCompact };
