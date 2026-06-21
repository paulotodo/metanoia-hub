'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ConnectionState } from '@/hooks/use-notification-stream';
import messages from '../../../messages/pt-BR.json';

const t = messages.notificationCenter.connection;

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  onRetry: () => void;
}

/**
 * ConnectionStatus — renders connection status indicator for the SSE stream.
 *
 * 4 states:
 *  - connected: renders null (no DOM — FR-013; avoids empty aria-live announcement — CHK035)
 *  - reconnecting: subtle "Reconectando..." below the bell (CHK025: positioned below icon in NotificationBell)
 *  - extended-outage: outage message + "Tentar agora" button (FR-004/005)
 *  - auth-error: session expired message + login link (CHK046/047)
 *
 * Accessibility:
 *  - aria-live="polite" on the status container (CHK032)
 *  - Transitions use motion-safe: prefix (CHK034)
 *  - Focus-ring on retry button: focus-visible:ring-2 focus-visible:ring-brand-teal/30 (CHK033)
 *  - Contrast: tokens text-foreground/bg-background satisfy WCAG 4.5:1 by project token design (CHK037)
 *
 * Positioning: CHK025 — positioned below the bell icon inside NotificationBell; documented here for audit.
 */
export function ConnectionStatus({ connectionState, onRetry }: ConnectionStatusProps) {
  // connected → render nothing (FR-013: no DOM node; CHK035: no aria-live announcement for empty)
  if (connectionState === 'connected') {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="motion-safe:transition-all text-sm text-muted-foreground px-2 py-1"
    >
      {connectionState === 'reconnecting' && (
        <span>{t.reconnecting}</span>
      )}

      {connectionState === 'extended-outage' && (
        <div className="flex items-center gap-2">
          <span className="text-foreground">{t.offline}</span>
          <button
            type="button"
            onClick={onRetry}
            className="underline text-sm text-foreground hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30"
          >
            {t.retryNow}
          </button>
        </div>
      )}

      {connectionState === 'auth-error' && (
        <div className="flex items-center gap-2">
          <span className="text-foreground">{t.authError}</span>
          <Link
            href="/login"
            className="underline text-sm text-foreground hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30"
          >
            {t.authErrorLink}
          </Link>
        </div>
      )}
    </div>
  );
}
