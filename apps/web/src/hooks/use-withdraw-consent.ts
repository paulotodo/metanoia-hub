'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { WithdrawConsentResponseSchema, type ConsentType } from '@metanoia/types';
import { envelopeClient } from '../lib/api/envelope';
import { consentHistoryKeys } from './use-consent-history';

export interface WithdrawConsentInput {
  consentType: ConsentType;
}

/**
 * useWithdrawConsent — submits a consent withdrawal for a given ConsentType.
 * After success, invalidates the consent-history query so the UI refreshes.
 *
 * PATCH /api/v1/consent/:consentType/withdraw
 *
 * Mutation contract: <undefined, Error, WithdrawConsentInput>
 * The mutationFn returns undefined (per project convention) — the actual
 * response is discarded since the query invalidation handles UI refresh.
 */
export function useWithdrawConsent() {
  const queryClient = useQueryClient();

  return useMutation<undefined, Error, WithdrawConsentInput>({
    mutationFn: async ({ consentType }: WithdrawConsentInput): Promise<undefined> => {
      await envelopeClient.patch(
        `/consent/${consentType}/withdraw`,
        {},
        WithdrawConsentResponseSchema,
      );
      return undefined;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: consentHistoryKeys.all });
    },
  });
}
