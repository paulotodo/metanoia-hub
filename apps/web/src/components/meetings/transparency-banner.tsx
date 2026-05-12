"use client";

import messages from "@/../messages/pt-BR.json";

export interface TransparencyBannerProps {
  /** When true, the banner adds a second line about focus-tab tracking
   * (NFR-L4 — read from tenant.focusIndicatorEnabled). */
  focusIndicatorEnabled: boolean;
}

/**
 * Story 5.5 — persistent transparency banner shown for the duration of a
 * meeting. Tells participants what signals are being captured before any
 * tracking begins (privacy-by-default guarantee, prerequisite for the
 * Story 5.4 focus heartbeat).
 */
export function TransparencyBanner({
  focusIndicatorEnabled,
}: TransparencyBannerProps) {
  const t = messages.meetingTransparency.banner;

  return (
    <aside
      data-testid="transparency-banner"
      role="status"
      aria-live="polite"
      className="mt-3 rounded-md border border-care-info/30 bg-care-info/5 px-4 py-3 text-sm text-text-secondary"
    >
      <p>{t.base}</p>
      {focusIndicatorEnabled ? (
        <p className="mt-1 text-text-muted" data-testid="transparency-banner-focus">
          {t.focusActive}
        </p>
      ) : null}
    </aside>
  );
}
