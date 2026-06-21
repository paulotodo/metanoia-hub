'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '@metanoia/ui';
import { useAsyncAnnouncer } from '@/components/a11y/async-announcer';
import { useUnreadNotifications } from '@/lib/api/hooks/use-notifications';
import { useNotificationSilence } from '@/hooks/use-notification-silence';
import { useNotificationStream } from '@/hooks/use-notification-stream';

const MAX_BADGE_COUNT = 99;

interface NotificationBellProps {
  onClick?: () => void;
  open?: boolean;
}

/**
 * NotificationBell — bell icon with unread badge (capped at 99+).
 * Announces new notifications via aria-live="polite" region.
 * Badge updates always; aria-live announcements respect silence toggle.
 */
export function NotificationBell({ onClick, open }: NotificationBellProps) {
  const { unreadCount } = useUnreadNotifications();
  const { silenced } = useNotificationSilence();
  const { announce } = useAsyncAnnouncer();

  // SSE subscription — invalidates query on realtime events
  useNotificationStream({ silenced, announce });

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
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="dialog"
      className="relative flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30 transition-colors"
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
  );
}
