"use client";

import { AlertTriangle } from "lucide-react";
import { RISK_REASON_LABELS } from "@metanoia/types";
import type { RiskReason } from "../../../../../../__mocks__/radar";

interface RiskReasonBadgeProps {
  riskReason: RiskReason;
}

/**
 * RiskReasonBadge — displays the evasion risk reason next to the semaphore.
 *
 * Shown on ParticipantCard when the participant has an active risk (FR66).
 * Uses text-secondary token (WCAG AA contrast) + icon + text (not color alone).
 * Updates announced via aria-live="polite" in parent SemaforoStatusRegion.
 *
 * Story 13.3 — FASE 9.1.
 */
export function RiskReasonBadge({ riskReason }: RiskReasonBadgeProps) {
  const label = RISK_REASON_LABELS[riskReason];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-care-urgent/30 bg-care-urgent/10 px-2 py-0.5 text-xs font-medium text-care-urgent"
      title={label}
      aria-label={`Motivo do risco: ${label}`}
    >
      <AlertTriangle
        className="size-3 shrink-0"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
