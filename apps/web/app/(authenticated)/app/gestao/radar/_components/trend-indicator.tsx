"use client";

import { useId } from "react";
import { cn } from "@metanoia/ui";
import type { TrendType } from "@metanoia/types";

interface TrendIndicatorProps {
  trend: TrendType;
  className?: string;
}

const TREND_CONFIG: Record<
  TrendType,
  {
    icon: string;
    label: string;
    colorClass: string;
    tooltipText: string;
    ariaLabel: string;
  }
> = {
  melhorando: {
    icon: "↑",
    label: "Melhorando",
    colorClass: "text-care-ok",
    tooltipText:
      "Participante com presença em crescimento — engajamento positivo recente.",
    ariaLabel: "tendência: melhorando",
  },
  estavel: {
    icon: "→",
    label: "Estável",
    colorClass: "text-text-secondary",
    tooltipText:
      "Participante com presença estável — sem mudança significativa recente.",
    ariaLabel: "tendência: estável",
  },
  declinio: {
    icon: "↓",
    label: "Em declínio",
    colorClass: "text-care-urgent",
    tooltipText:
      "Participante com presença em queda — requer atenção pastoral.",
    ariaLabel: "tendência: em declínio",
  },
};

export function TrendIndicator({ trend, className }: TrendIndicatorProps) {
  const config = TREND_CONFIG[trend];
  const tooltipId = useId();

  return (
    <span
      role="img"
      aria-label={config.ariaLabel}
      aria-describedby={tooltipId}
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-semibold",
        config.colorClass,
        className,
      )}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className="sr-only">{config.label}</span>
      {/* Accessible tooltip */}
      <span id={tooltipId} role="tooltip" className="sr-only">
        {config.tooltipText}
      </span>
    </span>
  );
}
