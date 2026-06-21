'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  NotificationsListSchema,
  ReadAllResponseSchema,
} from '@metanoia/types';
import { apiClient } from '../client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ---------------------------------------------------------------------------
// Query keys (hierarchical — follows repo pattern)
// ---------------------------------------------------------------------------

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
};

// ---------------------------------------------------------------------------
// Schema for mark-read response (simple { success: boolean })
// ---------------------------------------------------------------------------

// useUnreadNotifications — fetches unread notifications (status <> read)
// ---------------------------------------------------------------------------

export function useUnreadNotifications() {
  const { data, isLoading, isError } = useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () =>
      apiClient.getEnvelope('/notifications?unread=true&perPage=20', NotificationsListSchema),
    staleTime: 1000 * 30, // 30s — badge freshness tradeoff
    refetchOnWindowFocus: true,
  });

  return {
    notifications: data?.data ?? [],
    unreadCount: data?.meta?.total ?? 0,
    isLoading,
    isError,
  };
}

// ---------------------------------------------------------------------------
// useMarkRead — PATCH /notifications/:id/read
// ---------------------------------------------------------------------------

async function markReadFetch(id: string): Promise<void> {
  const token =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('accessToken')
      : null;
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('mark-read failed');
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markReadFetch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
  });
}

// ---------------------------------------------------------------------------
// useMarkAllRead — PATCH /notifications/read-all
// ---------------------------------------------------------------------------

async function markAllReadFetch(): Promise<{ updatedCount: number }> {
  const token =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('accessToken')
      : null;
  const res = await fetch(`${API_BASE}/notifications/read-all`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('mark-all-read failed');
  const json = (await res.json()) as { data: unknown };
  return ReadAllResponseSchema.parse(json.data);
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllReadFetch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
    // onError: NO optimistic state — do not persist partial marking (spec US3-2)
  });
}
