'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  TrailProgressDetailResponseSchema,
  ResumeProgressResponseSchema,
  type ReportProgressRequest,
} from '@metanoia/types';
import { apiClient } from '../client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const progressKeys = {
  all: ['progress'] as const,
  trail: (trailId: string) => [...progressKeys.all, 'trail', trailId] as const,
  resume: (trailId: string) => [...progressKeys.all, 'resume', trailId] as const,
};

// ---------------------------------------------------------------------------
// useTrailProgress — fetches aggregated progress for a trail (Client Component)
// ---------------------------------------------------------------------------

export function useTrailProgress(trailId: string) {
  return useQuery({
    queryKey: progressKeys.trail(trailId),
    queryFn: () =>
      apiClient.get('/progress/trails/' + trailId, TrailProgressDetailResponseSchema),
    enabled: !!trailId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// useResumeLesson — resolves the "Continuar de onde parei" lesson
// ---------------------------------------------------------------------------

export function useResumeLesson(trailId: string) {
  return useQuery({
    queryKey: progressKeys.resume(trailId),
    queryFn: () =>
      apiClient.get('/progress/trails/' + trailId + '/resume', ResumeProgressResponseSchema),
    enabled: !!trailId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// useReportProgress — enqueues a progress event (POST → 202 Accepted)
// ---------------------------------------------------------------------------

export function useReportProgress(lessonId: string) {
  return useMutation({
    mutationFn: (body: ReportProgressRequest) =>
      fetch(
        (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1') +
          '/progress/lessons/' + lessonId,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      ).then((res) => {
        if (!res.ok && res.status !== 202) {
          throw new Error('Failed to report progress');
        }
        return res.json() as Promise<{ data: { accepted: boolean } }>;
      }),
    // Fire-and-forget: do not invalidate queries on success (async processing)
  });
}
