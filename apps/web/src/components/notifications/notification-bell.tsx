'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '@metanoia/ui';
import { useAsyncAnnouncer } from '@/components/a11y/async-announcer';
import { useUnreadNotifications } from '@/lib/api/hooks/use-notifications';
import { useNotificationSilence } from '@/hooks/use-notification-silence';
import { useNotificationStream } from '@/hooks/use-notification-stream';
import { ConnectionStatus } from './connection-status';

const MAX_BADGE_COUNT = 99;

interface NotificationBellProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Controlled "open" state of the popover (drives aria-expanded). */
  open?: boolean;
}

/**
 * NotificationBell — bell icon with unread badge (capped at 99+).
 * Announces new notifications via aria-live="polite" region.
 * Badge updates always; aria-live announcements respect silence toggle.
 */
export const NotificationBell = React.forwardRef<
  HTMLButtonElement,
  NotificationBellProps
>(function NotificationBell({ open, ...rest }, ref) {
  const { unreadCount } = useUnreadNotifications();
  const { silenced } = useNotificationSilence();
  const { announce } = useAsyncAnnouncer();

  // SSE subscription — invalidates query on realtime events; returns connection state (Story 14-2c)
  const { connectionState, retryNow } = useNotificationStream({ silenced, announce });

  const displayCount = unreadCount > MAX_BADGE_COUNT ? '99+' : String(unreadCount);
  const hasUnread = unreadCount > 0;

  // Dynamic aria-label (PT-BR pastoral)
  let ariaLabel: string;
  if (!hasUnread) {
    ariaLabel = 'Sem notificações';
  } else if (unreadCount === 1) {
    ariaLabel = '1 notificação não lida';
  } else if (unreadCount > MAX_BADGE_COUNT) {
    ariaLabel = '99+ notificações não lidas';
  } else {
    ariaLabel = `${unreadCount} notificações não lidas`;
  }

  return (
    <>
    <button
      ref={ref}
      type="button"
      // `rest` carries the props Radix injects via <PopoverTrigger asChild>
      // (ref, onClick, onPointerDown, data-state, aria-*). Spreading them is
      // REQUIRED so Floating UI can measure the trigger and position the panel;
      // without it the popover renders at top:0 with a -200% transform (off-screen).
      {...rest}
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="dialog"
      className="relative flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30 motion-safe:transition-colors"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {hasUnread && (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 min-w-[1.25rem] px-1 text-[10px]"
        >
          {displayCount}
        </Badge>
      )}
    </button>
    {/* Connection status indicator (Story 14-2c — positioned below bell/badge — CHK025) */}
    <ConnectionStatus connectionState={connectionState} onRetry={retryNow} />
    </>
  );
});

NotificationBell.displayName = 'NotificationBell';
