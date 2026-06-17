"use client";

import { MessageCircle, Phone, MapPin, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  PASTORAL_NUDGE_SECTION_TITLE,
  PASTORAL_NUDGE_EMPTY_STATE,
  PASTORAL_NUDGE_CTA_LABEL,
  PASTORAL_NUDGE_SUGGESTION_LABELS,
} from "@metanoia/types";
import type { PastoralNudge, NudgeSuggestion } from "@metanoia/types";

// ---------------------------------------------------------------------------
// Icon + label map per suggestion type
// ---------------------------------------------------------------------------

const NUDGE_ICONS: Record<NudgeSuggestion, React.ElementType> = {
  call: Phone,
  visit: MapPin,
  message: MessageCircle,
};

function getSuggestionLabel(suggestion: NudgeSuggestion, name: string): string {
  const template = PASTORAL_NUDGE_SUGGESTION_LABELS[suggestion];
  return template.replace("{{name}}", name);
}

// ---------------------------------------------------------------------------
// Single nudge card
// ---------------------------------------------------------------------------

interface NudgeCardProps {
  nudge: PastoralNudge;
}

function NudgeCard({ nudge }: NudgeCardProps) {
  const Icon = NUDGE_ICONS[nudge.suggestion];
  const label = getSuggestionLabel(nudge.suggestion, nudge.participantName);

  return (
    <li>
      <Link
        href={`/app/gestao/radar/${nudge.participantId}/cuidado`}
        className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-elevated px-4 py-3 motion-safe:transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
        aria-label={`${label} — ${PASTORAL_NUDGE_CTA_LABEL}`}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal"
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-primary">
            {nudge.participantName}
          </span>
          <span className="block truncate text-xs text-text-secondary">
            {label}
          </span>
        </span>

        <ChevronRight
          className="size-4 shrink-0 text-text-muted"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// NudgePastoral section
// ---------------------------------------------------------------------------

interface NudgePastoralProps {
  nudges: PastoralNudge[];
  /** Optional: limit visible nudges before "show more". Defaults to 5. */
  visibleLimit?: number;
}

/**
 * NudgePastoral — proactive pastoral care nudge suggestions.
 *
 * Displays a list of participants that need proactive outreach based on:
 *   - 2+ consecutive absences → suggest calling
 *   - status = vermelho → suggest visiting
 *   - 7+ days inactive → suggest messaging
 *
 * Story 6-5: NudgePastoral component (MVP priority).
 * Text sourced from vocabulary.ts — no hardcoded strings.
 */
export function NudgePastoral({
  nudges,
  visibleLimit = 5,
}: NudgePastoralProps) {
  const visibleNudges = nudges.slice(0, visibleLimit);
  const hiddenCount = nudges.length - visibleNudges.length;

  return (
    <section aria-labelledby="nudge-pastoral-heading">
      <h2
        id="nudge-pastoral-heading"
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted"
      >
        {PASTORAL_NUDGE_SECTION_TITLE}
      </h2>

      {nudges.length === 0 ? (
        <p className="py-4 text-sm text-text-secondary">
          {PASTORAL_NUDGE_EMPTY_STATE}
        </p>
      ) : (
        <>
          <ul className="space-y-2" aria-label={PASTORAL_NUDGE_SECTION_TITLE}>
            {visibleNudges.map((nudge) => (
              <NudgeCard key={nudge.participantId} nudge={nudge} />
            ))}
          </ul>

          {hiddenCount > 0 && (
            <p className="mt-2 text-xs text-text-muted">
              +{hiddenCount} sugestão{hiddenCount !== 1 ? "ões" : ""} a mais
            </p>
          )}
        </>
      )}
    </section>
  );
}
