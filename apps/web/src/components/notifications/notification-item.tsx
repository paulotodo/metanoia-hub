'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationListItem } from '@metanoia/types';
import { formatRelativeTime } from '@/lib/notifications/format-relative-time';
import { safeNavigate } from '@/lib/notifications/safe-navigate';
import { NotificationIcon } from './notification-icon';

const MAX_PREVIEW_CHARS = 100;

interface NotificationItemProps {
  notification: NotificationListItem;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const router = useRouter();

  const preview = notification.body.length > MAX_PREVIEW_CHARS
    ? notification.body.slice(0, MAX_PREVIEW_CHARS) + '…'
    : notification.body;

  const meta = notification.metadata as Record<string, unknown> | undefined;
  const actionUrl = typeof meta?.actionUrl === 'string' ? meta.actionUrl : undefined;

  function handleClick() {
    onMarkRead(notification.id);
    if (actionUrl) {
      safeNavigate(actionUrl, router.push.bind(router));
    }
  }

  const isUnread = notification.status !== 'read';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left',
        'hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30',
        'motion-safe:transition-colors min-h-[44px]',
        isUnread ? 'font-medium' : 'opacity-75',
      ].join(' ')}
      aria-label={`${notification.title}: ${preview}`}
    >
      <NotificationIcon type={notification.type} className="mt-0.5 shrink-0 text-lg" />
      <div className="min-w-0 flex-1">
        {/* Render text-only — anti-XSS (no dangerouslySetInnerHTML) */}
        <p className="truncate text-sm">{notification.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
          {preview}
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
    </button>
  );
}
