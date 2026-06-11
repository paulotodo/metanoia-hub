'use client';

import { useQuery } from '@tanstack/react-query';
import {
  TrailResponseSchema,
  ModulesListResponseSchema,
  LessonsListResponseSchema,
  type TrailResponse,
  type ModulesListResponse,
  type LessonsListResponse,
} from '@metanoia/types';
import { apiClient } from '../client';
import { envelopeClient } from '../envelope';

// Note: apiClient.get unwraps { data: T } → T; envelopeClient.get parses full envelope { data: [...], meta: {} }

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const trailStructureKeys = {
  all: ['trail-structure'] as const,
  trail: (trailId: string) =>
    [...trailStructureKeys.all, 'trail', trailId] as const,
  modules: (trailId: string) =>
    [...trailStructureKeys.all, 'modules', trailId] as const,
  lessons: (trailId: string, moduleId: string) =>
    [...trailStructureKeys.all, 'lessons', trailId, moduleId] as const,
};

// ---------------------------------------------------------------------------
// useTrail — fetches trail metadata
// ---------------------------------------------------------------------------

export function useTrail(trailId: string) {
  return useQuery<TrailResponse>({
    queryKey: trailStructureKeys.trail(trailId),
    queryFn: () => apiClient.get(`/trails/${trailId}`, TrailResponseSchema),
    enabled: !!trailId,
    staleTime: 300_000,
  });
}

// ---------------------------------------------------------------------------
// useTrailModules — fetches all modules for a trail
// ---------------------------------------------------------------------------

export function useTrailModules(trailId: string) {
  return useQuery<ModulesListResponse>({
    queryKey: trailStructureKeys.modules(trailId),
    queryFn: () =>
      envelopeClient.get(`/trails/${trailId}/modules`, ModulesListResponseSchema),
    enabled: !!trailId,
    staleTime: 300_000,
  });
}

// ---------------------------------------------------------------------------
// useModuleLessons — fetches all lessons for a module (fan-out per module)
// ---------------------------------------------------------------------------

export function useModuleLessons(trailId: string, moduleId: string) {
  return useQuery<LessonsListResponse>({
    queryKey: trailStructureKeys.lessons(trailId, moduleId),
    queryFn: () =>
      envelopeClient.get(
        `/trails/${trailId}/modules/${moduleId}/lessons`,
        LessonsListResponseSchema,
      ),
    enabled: !!trailId && !!moduleId,
    staleTime: 300_000,
  });
}
