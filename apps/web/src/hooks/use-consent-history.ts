'use client';

import { useQuery } from '@tanstack/react-query';
import { ConsentHistoryResponseSchema, type ConsentHistoryResponse } from '@metanoia/types';
import { envelopeClient } from '../lib/api/envelope';

export const consentHistoryKeys = {
  all: ['consent-history'] as const,
  history: () => [...consentHistoryKeys.all, 'list'] as const,
};

/**
 * useConsentHistory — fetches the consolidated consent history for the
 * authenticated user: one item per ConsentType with status badge + timestamps.
 *
 * GET /api/v1/consent/history
 */
export function useConsentHistory() {
  return useQuery<ConsentHistoryResponse>({
    queryKey: consentHistoryKeys.history(),
    queryFn: () =>
      envelopeClient.get('/consent/history', ConsentHistoryResponseSchema),
    staleTime: 60_000,
  });
}
