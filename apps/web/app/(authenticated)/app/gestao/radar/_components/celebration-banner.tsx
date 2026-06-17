"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles } from "lucide-react";
import {
  PASTORAL_CELEBRATION_TITLE,
  PASTORAL_CELEBRATION_MESSAGE,
  PASTORAL_CELEBRATION_DISMISS,
} from "@metanoia/types";
import type { StatusImprovedItem } from "@metanoia/types";

// Auto-dismiss after 10 seconds
const AUTO_DISMISS_MS = 10_000;

interface CelebrationBannerProps {
  /** The positive transition event to celebrate. */
  event: StatusImprovedItem;
  /** Called when the banner is dismissed (for parent to remove it from state). */
  onDismiss: (id: string) => void;
}

/**
 * CelebrationBanner — celebrates a positive radar status transition.
 *
 * Shown when a participant's status improves (vermelho→amarelo or amarelo→verde).
 * Auto-dismisses after 10 seconds or on user click.
 * Text sourced from vocabulary.ts — no hardcoded strings.
 *
 * Story 6-5: CelebrationBanner component.
 */
export function CelebrationBanner({ event, onDismiss }: CelebrationBannerProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    setVisible(false);
    onDismiss(event.id);
  };

  // Keep dismiss ref current so the auto-timer always calls the latest version
  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });

  // Auto-dismiss after AUTO_DISMISS_MS
  useEffect(() => {
    timerRef.current = setTimeout(() => dismissRef.current(), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [event.id]);

  if (!visible) return null;

  const message = PASTORAL_CELEBRATION_MESSAGE.replace(
    "{{name}}",
    event.participantName,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-start gap-3 rounded-lg border border-care-ok/30 bg-care-ok/10 px-4 py-3"
      data-testid="celebration-banner"
    >
      <Sparkles
        className="mt-0.5 size-5 shrink-0 text-care-ok"
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">
          {PASTORAL_CELEBRATION_TITLE}
        </p>
        <p className="text-sm text-text-secondary">{message}</p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label={PASTORAL_CELEBRATION_DISMISS}
        className="shrink-0 rounded p-0.5 text-text-muted motion-safe:transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CelebrationBannerList — renders a dismissable stack of celebration events
// ---------------------------------------------------------------------------

interface CelebrationBannerListProps {
  events: StatusImprovedItem[];
  /** Optional: limit displayed banners. Defaults to 3. */
  limit?: number;
}

/**
 * Renders up to `limit` celebration banners, each individually dismissable.
 * Manages its own dismissed-set in local state to avoid re-rendering the
 * parent on each dismiss.
 */
export function CelebrationBannerList({
  events,
  limit = 3,
}: CelebrationBannerListProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const visible = events
    .filter((e) => !dismissed.has(e.id))
    .slice(0, limit);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2" aria-label="Notificações de melhoria">
      {visible.map((event) => (
        <CelebrationBanner
          key={event.id}
          event={event}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
