'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LeaderSummaryResponseSchema,
  type LeaderSummaryResponse,
  type LeaderSummaryQuery,
} from '@metanoia/types';
import { envelopeClient } from '../envelope';

// ─── Query key factory ────────────────────────────────────────────────────────

export const leaderSummaryKeys = {
  all: ['leader-summary'] as const,
  list: (query: Partial<LeaderSummaryQuery>) =>
    [...leaderSummaryKeys.all, 'list', query] as const,
};

// ─── Query string builder ─────────────────────────────────────────────────────

function buildLeaderSummaryQueryString(query: Partial<LeaderSummaryQuery>): string {
  const params = new URLSearchParams();
  if (query.period) params.set('period', query.period);
  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);
  if (query.groupId) params.set('groupId', query.groupId);
  return params.toString();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the consolidated leader summary report.
 *
 * - Leaders: sees metrics for their own groups only (authz horizontal).
 * - Admins: sees all groups in the tenant.
 *
 * The optional `groupId` parameter filters to a single group within the
 * leader's universe. If the group is not in the universe, the API returns
 * groups: [] with HTTP 200 (BOLA protection — no 403 disclosure).
 */
export function useLeaderSummary(query: Partial<LeaderSummaryQuery> = {}) {
  const qs = buildLeaderSummaryQueryString(query);
  const path = `/reports/leader-summary${qs ? `?${qs}` : ''}`;

  return useQuery<LeaderSummaryResponse>({
    queryKey: leaderSummaryKeys.list(query),
    queryFn: () => envelopeClient.get(path, LeaderSummaryResponseSchema),
    staleTime: 60_000,
  });
}
