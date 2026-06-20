"use client";

import { useEffect, useRef, useState } from "react";
import { X, Heart } from "lucide-react";
import {
  RISK_RESOLVED_BANNER_TITLE,
  RISK_RESOLVED_BANNER_MESSAGE,
  RISK_RESOLVED_BANNER_DISMISS,
} from "@metanoia/types";

// Auto-dismiss after 10 seconds (paridade com CelebrationBanner)
const AUTO_DISMISS_MS = 10_000;

interface RiskResolvedItem {
  id: string;
  participantName: string;
  resolvedAt: string;
}

interface RiskResolvedBannerProps {
  item: RiskResolvedItem;
  onDismiss: (id: string) => void;
}

/**
 * RiskResolvedBanner — anuncia que um participante voltou a se engajar.
 *
 * Mostrado quando risco de evasão é resolvido (2 presenças consecutivas).
 * Texto pastoral: "{Nome} voltou a participar!"
 * aria-live="polite" para leitores de tela.
 * Auto-dispensa após 10s.
 *
 * Story 13.3 — FASE 9.2.
 */
export function RiskResolvedBanner({ item, onDismiss }: RiskResolvedBannerProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    setVisible(false);
    onDismiss(item.id);
  };

  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });

  useEffect(() => {
    timerRef.current = setTimeout(() => dismissRef.current(), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id]);

  if (!visible) return null;

  const message = RISK_RESOLVED_BANNER_MESSAGE.replace(
    "{{name}}",
    item.participantName,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-start gap-3 rounded-lg border border-care-ok/30 bg-care-ok/10 px-4 py-3"
      data-testid="risk-resolved-banner"
    >
      <Heart
        className="mt-0.5 size-5 shrink-0 text-care-ok"
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">
          {RISK_RESOLVED_BANNER_TITLE}
        </p>
        <p className="text-sm text-text-secondary">{message}</p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label={RISK_RESOLVED_BANNER_DISMISS}
        className="shrink-0 rounded p-0.5 text-text-muted motion-safe:transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RiskResolvedBannerList — renderiza stack de banners de retorno
// ---------------------------------------------------------------------------

interface RiskResolvedBannerListProps {
  items: RiskResolvedItem[];
  limit?: number;
}

export function RiskResolvedBannerList({
  items,
  limit = 3,
}: RiskResolvedBannerListProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const visible = items
    .filter((e) => !dismissed.has(e.id))
    .slice(0, limit);

  if (visible.length === 0) return null;

  return (
    <div
      className="space-y-2"
      aria-label="Notificações de retorno ao engajamento"
    >
      {visible.map((item) => (
        <RiskResolvedBanner
          key={item.id}
          item={item}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
