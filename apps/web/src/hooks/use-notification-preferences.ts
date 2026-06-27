'use client';

/**
 * use-notification-preferences.ts — Story 16-1 (FR78)
 *
 * useNotificationPreferences()  — GET /api/v1/users/me/notification-preferences
 * useUpdateNotificationPreferences() — PATCH /api/v1/users/me/notification-preferences
 *   - Optimistic update: updates cache on onMutate; rolls back on error
 *
 * Constitution V: TanStack Query only in Client Components.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  NotificationPreferencesSchema,
  type NotificationPreferences,
  type UpdateNotificationPreferences,
} from '@metanoia/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('accessToken');
}

export const notifPrefKeys = {
  all: ['notification-preferences'] as const,
  mine: () => [...notifPrefKeys.all, 'mine'] as const,
};

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notifPrefKeys.mine(),
    queryFn: async (): Promise<NotificationPreferences> => {
      const token = getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/users/me/notification-preferences`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
        },
      );
      if (!response.ok) {
        throw new Error(
          `Falha ao carregar preferências: ${response.status}`,
        );
      }
      const json = (await response.json()) as { data: unknown };
      return NotificationPreferencesSchema.parse(json.data);
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation<
    NotificationPreferences,
    Error,
    UpdateNotificationPreferences,
    { previousPrefs: NotificationPreferences | undefined }
  >({
    mutationFn: async (
      dto: UpdateNotificationPreferences,
    ): Promise<NotificationPreferences> => {
      const token = getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/users/me/notification-preferences`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(dto),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          body.message ?? 'Não foi possível salvar sua preferência.',
        );
      }
      const json = (await response.json()) as { data: unknown };
      return NotificationPreferencesSchema.parse(json.data);
    },

    // Optimistic update
    onMutate: async (newPrefs) => {
      await queryClient.cancelQueries({ queryKey: notifPrefKeys.mine() });
      const previousPrefs = queryClient.getQueryData<NotificationPreferences>(
        notifPrefKeys.mine(),
      );

      queryClient.setQueryData<NotificationPreferences>(
        notifPrefKeys.mine(),
        (old) => {
          if (!old) return old;
          const next = { ...old };
          for (const [type, channels] of Object.entries(newPrefs)) {
            const t = type as keyof NotificationPreferences;
            if (channels) {
              next[t] = {
                ...next[t],
                ...(channels.inApp !== undefined ? { inApp: channels.inApp } : {}),
                ...(channels.email !== undefined ? { email: channels.email } : {}),
              };
            }
          }
          return next;
        },
      );

      return { previousPrefs };
    },

    onError: (_err, _dto, context) => {
      if (context?.previousPrefs !== undefined) {
        queryClient.setQueryData(notifPrefKeys.mine(), context.previousPrefs);
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notifPrefKeys.all,
      });
    },
  });
}
