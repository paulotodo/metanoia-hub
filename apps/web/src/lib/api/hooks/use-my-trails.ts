'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { MyTrailsResponseSchema, type MyTrailsResponse } from '@metanoia/types';
import { envelopeClient } from '../envelope';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const myTrailsKeys = {
  all: ['my-trails'] as const,
  list: () => [...myTrailsKeys.all, 'list'] as const,
};

// ---------------------------------------------------------------------------
// useMyTrails — infinite scroll of participant trails
// ---------------------------------------------------------------------------

/**
 * Fetches published trails assigned to the current participant's groups.
 * Cursor-based pagination for infinite scroll (10 per page).
 *
 * Sort (server-side): in_progress → not_started → completed.
 */
export function useMyTrails() {
  return useInfiniteQuery<MyTrailsResponse>({
    queryKey: myTrailsKeys.list(),
    queryFn: ({ pageParam }) => {
      const cursor = pageParam as string | undefined;
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=10` : '?limit=10';
      return envelopeClient.get(`/my-trails${qs}`, MyTrailsResponseSchema);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: 60_000,
  });
}
