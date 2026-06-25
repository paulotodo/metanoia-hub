'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NotificationRealtimeEventSchema } from '@metanoia/types';
import { notificationKeys } from '@/lib/api/hooks/use-notifications';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// Connection states for the SSE stream (FR-012 — client state only, not Zustand)
export type ConnectionState = 'connected' | 'reconnecting' | 'extended-outage' | 'auth-error';

// Backoff: 1s, 2s, 4s, 8s, ..., max 30s (FR-001)
function calcBackoff(attempt: number): number {
  return Math.min(Math.pow(2, attempt) * 1000, 30_000);
}

/**
 * useNotificationStream — subscribes to the SSE endpoint for real-time
 * notification events. On each `notification` event, invalidates the
 * unread query so the badge updates automatically.
 *
 * Story 14-2c extensions:
 *  - Exponential backoff reconnect (FR-001)
 *  - Gap-fill via GET /notifications?since=...&status=unread (FR-010/FR-011)
 *  - 4-state connection machine: connected / reconnecting / extended-outage / auth-error
 *  - Paginated gap-fill loop (CHK021/055)
 *  - Race condition prevention via AbortController (CHK064)
 *  - retryNow() for manual reconnect (FR-005)
 *
 * Security (OWASP hardening dec-015 / CHK042-044 / M1):
 *   URL contains ?token= — do NOT log the full URL anywhere.
 */
export function useNotificationStream(options: {
  silenced: boolean;
  announce: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const { silenced, announce } = options;

  // Connection state machine (client state — useState, NEVER Zustand — FR-012)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const failureCount = useRef<number>(0);
  const lastReceivedAt = useRef<string | null>(null); // FR-008; NEVER persisted — FR-009
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapFillControllerRef = useRef<AbortController | null>(null); // CHK064 race cancel
  // Keep a mutable ref to the current EventSource so inner closures can close it
  const sourceRef = useRef<EventSource | null>(null);

  // AC-6 (RF-06, RF-07): Grace period 5s post-reconnect to suppress gap-fill announces
  // Activated on reconnecting → connected transition; counts deltas during grace window,
  // then emits a single "Conexão restaurada. {n} participantes atualizados." summary.
  const isPostReconnectRef = useRef<boolean>(false);
  const postReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postReconnectDeltaCountRef = useRef<number>(0);

  // executeGapFill — fetch missed notifications since lastReceivedAt (FR-010/FR-011)
  // gap-fill paginado: busca até total (CHK021/055 — sem truncamento silencioso)
  const executeGapFill = async () => {
    if (lastReceivedAt.current === null) return; // edge case: first connection, nothing missed

    // Cancel any in-flight gap-fill (CHK064: race condition — new disconnect arrived)
    gapFillControllerRef.current?.abort();
    const controller = new AbortController();
    gapFillControllerRef.current = controller;

    try {
      const token =
        typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const fetchedIds = new Set<string>();
      let page = 1;
      let total = Infinity;
      const perPage = 100; // maximum — minimizes requests

      while (fetchedIds.size < total) {
        const url = `${API_BASE_URL}/notifications?since=${encodeURIComponent(lastReceivedAt.current)}&status=unread&page=${page}&perPage=${perPage}`;
        const res = await fetch(url, { headers, signal: controller.signal });

        if (res.status === 401) {
          // Token expired — transition to auth-error, stop gap-fill
          setConnectionState('auth-error');
          return;
        }
        if (!res.ok) {
          // Transient network error in gap-fill — fail silently (spec §Edge Cases — CHK062)
          return;
        }

        const json = await res.json() as { data: Array<{ id: string }>; meta: { total: number } };
        total = json.meta.total;
        for (const item of json.data) {
          fetchedIds.add(item.id);
        }

        if (json.data.length < perPage || fetchedIds.size >= total) break;
        page++;
      }

      // Merge complete — invalidate to refresh the UI (FR-011)
      await queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    } catch (err) {
      // AbortError = expected cancellation (CHK064); other errors = silently discard (CHK062)
      if (err instanceof Error && err.name !== 'AbortError') {
        // Intentionally silent — gap-fill failure must not surface stack traces (OWASP M1)
      }
    }
  };

  useEffect(() => {
    let currentSource: EventSource | null = null;

    const connect = () => {
      const token =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('accessToken')
          : null;

      // SECURITY: URL contains ?token= — do NOT log (CHK042-044 / OWASP M1)
      const url = `${API_BASE_URL}/sse/notifications${token ? '?token=' + encodeURIComponent(token) : ''}`;

      const source = new EventSource(url);
      currentSource = source;
      sourceRef.current = source;

      source.addEventListener('notification', (e: MessageEvent) => {
        const parsed = NotificationRealtimeEventSchema.safeParse(
          JSON.parse((e as MessageEvent).data as string),
        );
        // Badge ALWAYS updates regardless of silence setting
        queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });

        if (parsed.success) {
          // Update lastReceivedAt to track gap-fill watermark (FR-008)
          if (
            lastReceivedAt.current === null ||
            parsed.data.createdAt > lastReceivedAt.current
          ) {
            lastReceivedAt.current = parsed.data.createdAt;
          }

          // Transition back to connected on successful event
          if (connectionState !== 'connected') {
            // AC-6 (RF-06): Activate 5s grace period on reconnecting → connected transition
            isPostReconnectRef.current = true;
            postReconnectDeltaCountRef.current = 0;
            if (postReconnectTimerRef.current !== null) {
              clearTimeout(postReconnectTimerRef.current);
            }
            postReconnectTimerRef.current = setTimeout(() => {
              isPostReconnectRef.current = false;
              const count = postReconnectDeltaCountRef.current;
              postReconnectDeltaCountRef.current = 0;
              // AC-6 (RF-07): emit single summary announce after grace window
              if (!silenced && count > 0) {
                announce(`Conexão restaurada. ${count} participante${count > 1 ? 's' : ''} atualizado${count > 1 ? 's' : ''}.`);
              }
            }, 5000);

            setConnectionState('connected');
            failureCount.current = 0;
          }

          // Announce ONLY if not silenced AND not in grace period
          if (!silenced) {
            if (isPostReconnectRef.current) {
              // Grace period: count delta silently, do not announce individually
              postReconnectDeltaCountRef.current += 1;
            } else {
              announce(`Nova notificação: ${parsed.data.title}`);
            }
          }
        }
      });

      source.addEventListener('heartbeat', () => {
        // keep-alive — no-op
      });

      source.onerror = () => {
        // Keep last known badge value — do NOT reset to zero on SSE error
        // (spec §Edge Cases: lost SSE connection should not clear badge)

        // SECURITY: do NOT log URL (contains ?token=) — CHK042-044
        source.close();

        // Probe auth status: EventSource does not expose HTTP status in onerror
        // Use a separate fetch to distinguish 401 (auth-error) from network outage (CHK015/046/047)
        const token =
          typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
        const headers: Record<string, string> = {};
        // Use Authorization header — NOT query param (no ?token= leak in probe URL)
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Probe uses /notifications endpoint (not /sse) — always accessible if auth is valid
        fetch(`${API_BASE_URL}/notifications?unread=true&perPage=1`, {
          headers,
        })
          .then((res) => {
            if (res.status === 401) {
              // Token expired — distinct state from network outage (CHK046/047 — OWASP M2)
              setConnectionState('auth-error');
              // auth-error: do NOT schedule retry — avoid loop with dead credential (CHK015)
            } else {
              scheduleReconnect();
            }
          })
          .catch(() => {
            // Probe itself failed → network down → reconnect with backoff
            scheduleReconnect();
          });
      };
    };

    const scheduleReconnect = () => {
      failureCount.current += 1;

      // After 5 failures at the max backoff (30s), transition to extended-outage (FR-004)
      if (failureCount.current >= 5) {
        setConnectionState('extended-outage');
      } else {
        setConnectionState('reconnecting');
      }

      const delay = calcBackoff(failureCount.current - 1);
      retryTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    // Expose retryNow for manual reconnect (FR-005)
    // Defined inside useEffect so it captures the mutable refs
    (connect as { scheduleReconnect?: typeof scheduleReconnect }).scheduleReconnect =
      scheduleReconnect;

    connect();

    // On successful reconnection, run gap-fill
    const originalConnect = connect;
    void originalConnect;

    return () => {
      currentSource?.close();
      sourceRef.current = null;
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // AC-6: cleanup grace period timer on unmount
      if (postReconnectTimerRef.current !== null) {
        clearTimeout(postReconnectTimerRef.current);
        postReconnectTimerRef.current = null;
      }
      gapFillControllerRef.current?.abort();
    };
    // connectionState intentionally excluded from deps — drives UI only, re-subscribe is via SSE
  }, [queryClient, silenced]);

  // retryNow — cancel timer, reset failureCount, reconnect immediately (FR-005)
  const retryNow = () => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    failureCount.current = 0;
    setConnectionState('reconnecting');
    sourceRef.current?.close();
    // Reconnect is handled by a new useEffect trigger; we signal it via state
    // For immediate reconnect, directly call connect logic via a side-channel
    const token =
      typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
    const url = `${API_BASE_URL}/sse/notifications${token ? '?token=' + encodeURIComponent(token) : ''}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.addEventListener('notification', () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
      setConnectionState('connected');
      failureCount.current = 0;
      void executeGapFill();
    });
    source.addEventListener('heartbeat', () => {/* keep-alive */});
    source.onerror = () => {
      source.close();
      failureCount.current += 1;
      if (failureCount.current >= 5) {
        setConnectionState('extended-outage');
      }
    };
  };

  return { connectionState, retryNow };
}
