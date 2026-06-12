'use client';

import { useQuery } from '@tanstack/react-query';
import { CurrentUserSchema, type CurrentUser } from '@metanoia/types';
import { apiClient } from '../lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const currentUserKeys = {
  all: ['current-user'] as const,
  me: () => [...currentUserKeys.all, 'me'] as const,
};

// ---------------------------------------------------------------------------
// useCurrentUser — returns the authenticated user profile including status.
//
// AVS-02: useAuth() does not expose user.status. This hook calls
// GET /api/v1/users/me and provides the full user profile, including
// status (active | deletion_pending | deleted | pending_verification).
// Used to render the DeletionPendingBanner when status === 'deletion_pending'.
// ---------------------------------------------------------------------------

export interface UseCurrentUserReturn {
  user: CurrentUser | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useCurrentUser(): UseCurrentUserReturn {
  const query = useQuery<CurrentUser>({
    queryKey: currentUserKeys.me(),
    queryFn: () => apiClient.get('/users/me', CurrentUserSchema),
    staleTime: 1000 * 60 * 2, // 2 min — status can change after deletion request
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
