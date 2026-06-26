'use client';

import { useQuery } from '@tanstack/react-query';
import { LessonResponseSchema, type LessonResponse } from '@metanoia/types';
import { apiClient } from '../client';

export const lessonKeys = {
  all: ['lesson'] as const,
  byId: (trailId: string, moduleId: string, lessonId: string) =>
    [...lessonKeys.all, trailId, moduleId, lessonId] as const,
};

export function useLesson(trailId: string, moduleId: string, lessonId: string) {
  return useQuery<LessonResponse>({
    queryKey: lessonKeys.byId(trailId, moduleId, lessonId),
    queryFn: () =>
      apiClient.get(
        `/trails/${trailId}/modules/${moduleId}/lessons/${lessonId}`,
        LessonResponseSchema,
      ),
    enabled: !!trailId && !!moduleId && !!lessonId,
    staleTime: 60_000,
  });
}
