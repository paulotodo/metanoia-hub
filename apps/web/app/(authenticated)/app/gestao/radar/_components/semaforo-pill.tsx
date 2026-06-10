"use client";

import { cn } from "@metanoia/ui";
import { SEMAFORO_STATUS_LABELS } from "@metanoia/types";
import type { SignalType } from "../../../../../../__mocks__/radar";

type PillState = "default" | "active" | "filter-active" | "dimmed" | "zero";

interface SemaforoPillProps {
  signalType: SignalType;
  count: number;
  delta: number;
  state: PillState;
  showDelta: boolean;
  onTap: () => void;
}

const pillConfig: Record<
  SignalType,
  { label: string; colorClass: string; bgClass: string; solidClass: string }
> = {
  "care-urgent": {
    label: SEMAFORO_STATUS_LABELS.urgent,
    colorClass: "text-care-urgent",
    bgClass: "bg-care-urgent/10",
    solidClass: "bg-care-urgent text-text-inverse",
  },
  "care-attention": {
    label: SEMAFORO_STATUS_LABELS.attention,
    colorClass: "text-care-attention",
    bgClass: "bg-care-attention/10",
    solidClass: "bg-care-attention text-text-inverse",
  },
  "care-ok": {
    label: SEMAFORO_STATUS_LABELS.ok,
    colorClass: "text-care-ok",
    bgClass: "bg-care-ok/10",
    solidClass: "bg-care-ok text-text-inverse",
  },
};

function getAriaPressed(state: PillState): "false" | "true" | "mixed" {
  if (state === "active") return "true";
  if (state === "filter-active") return "mixed";
  return "false";
}

export function SemaforoPill({
  signalType,
  count,
  delta,
  state,
  showDelta,
  onTap,
}: SemaforoPillProps) {
  const config = pillConfig[signalType];
  const isZero = count === 0;
  const effectiveState = isZero ? "zero" : state;

  return (
    <button
      type="button"
      role="switch"
      aria-pressed={getAriaPressed(effectiveState)}
      aria-label={`${config.label}: ${count}`}
      onClick={onTap}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus",
        effectiveState === "default" && [
          "border",
          `border-current`,
          config.colorClass,
          config.bgClass,
        ],
        effectiveState === "active" && [
          "border-2",
          "shadow-sm",
          config.colorClass,
          config.bgClass,
        ],
        effectiveState === "filter-active" && config.solidClass,
        effectiveState === "dimmed" && [
          "border border-current opacity-40",
          config.colorClass,
          config.bgClass,
        ],
        effectiveState === "zero" && [
          "border border-border-default bg-surface-sunken text-text-muted",
        ],
      )}
    >
      <span>{count}</span>
      {showDelta && delta > 0 && effectiveState !== "zero" && (
        <span className="text-xs font-normal">(+{delta})</span>
      )}
    </button>
  );
}
