'use client';

import * as React from 'react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@metanoia/ui';
import type { NotificationListItem } from '@metanoia/types';
import { useUnreadNotifications, useMarkAllRead } from '@/lib/api/hooks/use-notifications';
import { useNotificationSilence } from '@/hooks/use-notification-silence';
import { NotificationBell } from './notification-bell';
import { NotificationItem } from './notification-item';
import { useMarkRead } from '@/lib/api/hooks/use-notifications';

/**
 * NotificationCenter — dropdown panel with the bell trigger.
 * Lists unread notifications, supports mark-all-read and silence toggle.
 * All text rendered as text nodes (no dangerouslySetInnerHTML — anti-XSS).
 */
export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount } = useUnreadNotifications();
  const { silenced, setSilenced } = useNotificationSilence();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  function handleMarkRead(id: string) {
    markRead.mutate(id);
    // Optimistically close if last notification
    if (unreadCount === 1) setOpen(false);
  }

  function handleMarkAll() {
    markAllRead.mutate();
  }

  return (
    <>
      {/* aria-live region for real-time announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="notification-live-region"
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/*
            No manual onClick here: <PopoverTrigger asChild> injects its own
            click handler (and the trigger ref) which NotificationBell now
            forwards. Adding a second setOpen handler would double-toggle.
          */}
          <NotificationBell open={open} data-testid="notification-bell" />
        </PopoverTrigger>

        <PopoverContent
          className="w-80 p-0"
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions
          role="dialog"
          aria-label="Notificações"
          data-testid="notification-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-sm font-semibold">Notificações</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSilenced(!silenced)}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30 rounded px-1"
              >
                {silenced ? 'Ativar alertas' : 'Silenciar'}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={markAllRead.isPending}
                  className="text-xs text-[var(--primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-brand-teal/30 rounded px-1 disabled:opacity-50"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              /* Empty state pastoral */
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                <span className="text-2xl" aria-hidden="true">✓</span>
                <p className="text-sm font-medium">Tudo em ordem</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Você está em dia com a sua congregação. Nenhuma notificação pendente.
                </p>
              </div>
            ) : (
              <ul role="list" className="divide-y divide-[var(--border)]">
                {notifications.map((n: NotificationListItem) => (
                  <li key={n.id} role="listitem">
                    <NotificationItem
                      notification={n}
                      onMarkRead={handleMarkRead}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
