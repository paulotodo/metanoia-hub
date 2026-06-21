'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NotificationRealtimeEventSchema } from '@metanoia/types';
import { notificationKeys } from '@/lib/api/hooks/use-notifications';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * useNotificationStream — subscribes to the SSE endpoint for real-time
 * notification events. On each `notification` event, invalidates the
 * unread query so the badge updates automatically.
 *
 * Security (OWASP hardening dec-015):
 *   URL contains ?token= — do NOT log the full URL anywhere.
 */
export function useNotificationStream(options: {
  silenced: boolean;
  announce: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const { silenced, announce } = options;

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('accessToken')
        : null;

    // SECURITY: URL contains ?token= — do not log
    const url = `${API_BASE_URL}/sse/notifications${token ? '?token=' + encodeURIComponent(token) : ''}`;

    const source = new EventSource(url);

    source.addEventListener('notification', (e: MessageEvent) => {
      const parsed = NotificationRealtimeEventSchema.safeParse(
        JSON.parse((e as MessageEvent).data as string),
      );
      // Badge ALWAYS updates regardless of silence setting
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });

      // Announce ONLY if not silenced
      if (parsed.success && !silenced) {
        announce(`Nova notificação: ${parsed.data.title}`);
      }
    });

    source.addEventListener('heartbeat', () => {
      // keep-alive — no-op
    });

    source.onerror = () => {
      // Keep last known badge value — do NOT reset to zero on SSE error
      // (spec §Edge Cases: lost SSE connection should not clear badge)
    };

    return () => {
      source.close();
    };
  }, [queryClient, silenced]);
}
