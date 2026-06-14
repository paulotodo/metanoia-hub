'use client';

import { useQuery } from '@tanstack/react-query';
import type { ImportJobStatus } from '@metanoia/types';

/**
 * useImportJobStatus — polls GET /api/v1/import/jobs/:jobId
 *
 * - Polls every 2 s while status === 'processing'
 * - Stops polling when status is 'completed' or 'failed'
 * - Returns undefined when jobId is null (disabled query)
 *
 * Usage: Client Components only.
 */
export function useImportJobStatus(jobId: string | null) {
  return useQuery<ImportJobStatus | undefined>({
    queryKey: ['import-job', jobId],
    queryFn: async () => {
      if (!jobId) return undefined;
      const resp = await fetch(`/api/v1/import/jobs/${jobId}`);
      if (!resp.ok) {
        throw new Error(`Failed to fetch job status (${resp.status})`);
      }
      const json = (await resp.json()) as { data: ImportJobStatus };
      return json.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return data.status === 'processing' ? 2000 : false;
    },
  });
}
