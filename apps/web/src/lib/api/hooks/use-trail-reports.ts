'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  TrailReportResponseSchema,
  TrailsSummaryResponseSchema,
  ExportJobStatusSchema,
  type TrailReportResponse,
  type TrailsSummaryResponse,
  type ExportJobStatus,
  type TrailReportQuery,
} from '@metanoia/types';
import { envelopeClient } from '../envelope';

export const trailReportKeys = {
  all: ['trail-reports'] as const,
  trailDetail: (trailId: string, query?: Partial<TrailReportQuery>) =>
    [...trailReportKeys.all, trailId, query] as const,
  summary: () => [...trailReportKeys.all, 'summary'] as const,
  job: (jobId: string) => [...trailReportKeys.all, 'jobs', jobId] as const,
};

/**
 * Hook: list all trails summary — admin only.
 */
export function useTrailsSummary() {
  return useQuery<TrailsSummaryResponse>({
    queryKey: trailReportKeys.summary(),
    queryFn: () => envelopeClient.get('/reports/trails', TrailsSummaryResponseSchema),
    staleTime: 60_000,
  });
}

/**
 * Hook: trail participant report — admin or lider.
 */
export function useTrailReport(
  trailId: string,
  query: Partial<TrailReportQuery> = {},
) {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.perPage) params.set('perPage', String(query.perPage));
  if (query.status) params.set('status', query.status);
  if (query.lastActivityAfter) params.set('lastActivityAfter', query.lastActivityAfter);
  if (query.lastActivityBefore) params.set('lastActivityBefore', query.lastActivityBefore);

  const qs = params.toString();
  const path = `/reports/trails/${trailId}${qs ? `?${qs}` : ''}`;

  return useQuery<TrailReportResponse>({
    queryKey: trailReportKeys.trailDetail(trailId, query),
    queryFn: () => envelopeClient.get(path, TrailReportResponseSchema),
    enabled: trailId.length > 0,
    staleTime: 30_000,
  });
}

/**
 * Hook: trigger CSV export for a trail.
 * Returns jobId (async) or triggers browser download (inline CSV handled server-side).
 */
export function useExportTrailCsv() {
  return useMutation<{ jobId: string } | null, Error, { trailId: string }>({
    mutationFn: async ({ trailId }) => {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

      const response = await fetch(`${API_BASE_URL}/reports/trails/${trailId}/export?format=csv`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.status === 202) {
        const json = (await response.json()) as { data: { jobId: string } };
        return { jobId: json.data.jobId };
      }

      if (response.ok) {
        // Inline CSV: trigger browser download
        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition') ?? '';
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const filename = filenameMatch ? filenameMatch[1] : 'relatorio-trilha.csv';

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return null; // download triggered inline
      }

      throw new Error(`Erro ao exportar: ${response.status}`);
    },
  });
}

/**
 * Hook: poll export job status.
 * The API returns { data: ExportJobStatusInner }; envelopeClient parses via ExportJobStatusSchema.
 */
export function useExportJobStatus(jobId: string | null) {
  return useQuery<ExportJobStatus>({
    queryKey: trailReportKeys.job(jobId ?? ''),
    queryFn: () => envelopeClient.get(`/reports/jobs/${jobId}`, ExportJobStatusSchema),
    enabled: jobId !== null && jobId.length > 0,
    refetchInterval: (query) => {
      const status = (query.state.data as { data?: { status?: string } } | undefined)?.data?.status;
      if (!status) return 3000;
      return status === 'processing' ? 3000 : false;
    },
    staleTime: 0,
  });
}
