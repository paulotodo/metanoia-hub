'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TenantSummaryResponseSchema,
  type TenantSummaryResponse,
  type TenantSummaryQuery,
} from '@metanoia/types';
import { envelopeClient } from '../envelope';

/** Query keys factory for the tenant report (FR65 / Story 13.2b). */
export const tenantReportKeys = {
  all: ['tenant-report'] as const,
  summary: (query?: Partial<TenantSummaryQuery>) =>
    [...tenantReportKeys.all, 'summary', query] as const,
};

/** Refresh response shape (202 accepted / 429 rate-limited). */
export interface TenantRefreshResult {
  accepted: boolean;
  jobId: string | null;
  retryAfter: number | null;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function buildSummaryPath(query: Partial<TenantSummaryQuery>): string {
  const params = new URLSearchParams();
  if (query.period) params.set('period', query.period);
  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);
  if (query.groupId) params.set('groupId', query.groupId);
  if (query.status) params.set('status', query.status);
  const qs = params.toString();
  return `/reports/tenant-summary${qs ? `?${qs}` : ''}`;
}

/**
 * Hook: tenant consolidated summary from the Materialized View — admin only.
 * Polls every 60s to surface fresh MV data (refreshed by the cron job).
 */
export function useTenantSummary(query: Partial<TenantSummaryQuery> = {}) {
  return useQuery<TenantSummaryResponse>({
    queryKey: tenantReportKeys.summary(query),
    queryFn: () =>
      envelopeClient.get(buildSummaryPath(query), TenantSummaryResponseSchema),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * Hook: trigger an on-demand MV refresh (rate-limited 1/5min/tenant).
 * Returns the 202/429 result; on success the summary query is invalidated.
 */
export function useTenantRefresh() {
  const queryClient = useQueryClient();

  return useMutation<TenantRefreshResult, Error>({
    mutationFn: async () => {
      const token =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('accessToken')
          : null;

      const response = await fetch(
        `${API_BASE_URL}/reports/tenant-summary/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      const json = (await response.json().catch(() => ({}))) as {
        data?: { accepted?: boolean; jobId?: string | null };
        meta?: { retryAfter?: number | null };
      };

      return {
        accepted: json.data?.accepted ?? response.status === 202,
        jobId: json.data?.jobId ?? null,
        retryAfter: json.meta?.retryAfter ?? null,
      };
    },
    onSuccess: (result) => {
      if (result.accepted) {
        void queryClient.invalidateQueries({ queryKey: tenantReportKeys.all });
      }
    },
  });
}
