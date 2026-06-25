"use client";

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@metanoia/ui";
import { SIGNAL_STATUS_LABELS } from "@metanoia/types";
import type { SignalType } from "@metanoia/types";

// ---------------------------------------------------------------------------
// SemaforoStatusBadge — Story 15.3 (FR-001/002/003/004/005/006/007/009/010)
//
// Componente canônico: cor + ícone Lucide + texto visível por participante.
// ARIA: ícone aria-hidden; texto visível carrega o significado (fonte única).
// Pulso: motion-safe:animate-[pulse-border_1s_ease-out] quando animatePulse.
// Modo compacto: ícone >=16px (size-4); texto abreviado + aria-label completo.
//
// Decisões: dec-005 (SIGNAL_STATUS_LABELS), dec-006 (animatePulse), dec-007
//   (sr-only → visível). Modelo: risk-reason-badge.tsx.
// ---------------------------------------------------------------------------

interface SemaforoStatusBadgeProps {
  signalType: SignalType;
  /** Quando presente, compõe aria-label contextual ("{label} — {name}").
   *  O texto visível interno fica aria-hidden para evitar duplo-anúncio. */
  participantName?: string;
  /** Modo compacto: texto abreviado mas aria-label completo. Nunca title. */
  compact?: boolean;
  /** Aciona animação de pulso (motion-safe). Disparado pelo pai após delta de status. */
  animatePulse?: boolean;
  className?: string;
}

const BADGE_CONFIG = {
  "care-urgent": {
    Icon: AlertCircle,
    colorClass: "text-care-urgent",
    bgClass: "bg-care-urgent/10",
    borderClass: "border-care-urgent/30",
  },
  "care-attention": {
    Icon: AlertTriangle,
    colorClass: "text-care-attention",
    bgClass: "bg-care-attention/10",
    borderClass: "border-care-attention/30",
  },
  "care-ok": {
    Icon: CheckCircle2,
    colorClass: "text-care-ok",
    bgClass: "bg-care-ok/10",
    borderClass: "border-care-ok/30",
  },
} as const satisfies Record<SignalType, { Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true"; focusable?: "false" }>; colorClass: string; bgClass: string; borderClass: string }>;

/**
 * SemaforoStatusBadge — badge pastoral multimodal (cor + ícone + texto).
 *
 * Cumpre WCAG 1.4.1 (informação não transmitida apenas por cor).
 * Texto visível é a fonte única para leitores de tela — sem duplo-anúncio.
 * Animação de pulso respeita prefers-reduced-motion via `motion-safe:`.
 */
export function SemaforoStatusBadge({
  signalType,
  participantName,
  compact = false,
  animatePulse = false,
  className,
}: SemaforoStatusBadgeProps) {
  const { Icon, colorClass, bgClass, borderClass } = BADGE_CONFIG[signalType];
  const fullLabel = SIGNAL_STATUS_LABELS[signalType];

  // Aria-label contextual quando nome do participante está presente
  const ariaLabel = participantName
    ? `${fullLabel} — ${participantName}`
    : undefined;

  // Em modo compacto: texto abreviado — só a primeira palavra do label
  const visibleText = compact ? fullLabel.split(" ")[0] : fullLabel;

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        colorClass,
        bgClass,
        borderClass,
        // Pulso: motion-safe garante supressão automática em prefers-reduced-motion
        animatePulse && [
          "motion-safe:animate-[pulse-border_1s_ease-out]",
          // motion-reduce fallback: apenas transição de opacidade sutil
          "motion-reduce:transition-opacity motion-reduce:duration-150",
        ],
        className,
      )}
    >
      {/* Ícone: aria-hidden + focusable=false — o texto carrega o significado */}
      <Icon
        className="size-4 shrink-0"
        aria-hidden="true"
        focusable="false"
      />
      {/* Texto visível: aria-hidden somente quando aria-label contextual presente */}
      <span aria-hidden={ariaLabel ? "true" : undefined}>{visibleText}</span>
    </span>
  );
}
