import { useQuery } from '@tanstack/react-query';
import { AccessibilityGapsResponseSchema } from '@metanoia/types';
import { apiClient } from '../client';

export const accessibilityGapsKeys = {
  all: ['accessibility-gaps'] as const,
  list: (page: number, pageSize: number) =>
    [...accessibilityGapsKeys.all, 'list', page, pageSize] as const,
};

export function useAccessibilityGaps(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: accessibilityGapsKeys.list(page, pageSize),
    queryFn: () =>
      apiClient.getEnvelope(
        `/admin/accessibility-gaps?page=${page}&pageSize=${pageSize}`,
        AccessibilityGapsResponseSchema,
      ),
    staleTime: 1000 * 60 * 5, // 5 min — admin audit data is not real-time
  });
}
