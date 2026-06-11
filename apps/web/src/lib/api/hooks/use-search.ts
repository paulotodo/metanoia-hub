'use client';

import { useQuery } from '@tanstack/react-query';
import { searchResponseSchema, type SearchResponse } from '@metanoia/types';
import { envelopeClient } from '../envelope';

export const searchKeys = {
  all: ['search'] as const,
  results: (q: string) => [...searchKeys.all, q] as const,
};

/**
 * Hook: full-text search over lessons within the current tenant.
 *
 * Only triggers when `q` is a non-empty string (min 1 char after trim).
 * Returns up to 20 results sorted by ts_rank DESC.
 * Always returns 200 — empty data when no matches (FR-010).
 *
 * snippet field uses sentinel chars \x02/\x03 — use <SearchHighlight> to render.
 */
export function useSearch(q: string) {
  const trimmed = q.trim();
  const enabled = trimmed.length > 0;

  return useQuery<SearchResponse>({
    queryKey: searchKeys.results(trimmed),
    queryFn: () =>
      envelopeClient.get(
        `/search?q=${encodeURIComponent(trimmed)}`,
        searchResponseSchema,
      ),
    enabled,
    staleTime: 30_000,
    // Disable refetch on window focus — search results are user-driven
    refetchOnWindowFocus: false,
  });
}
