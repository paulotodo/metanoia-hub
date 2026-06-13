'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PrivacyDeletionResponseEnvelopeSchema,
  PrivacyDeletionStatusEnvelopeSchema,
  type PrivacyDeletionResponse,
  type PrivacyDeletionStatus,
} from '@metanoia/types';
import { envelopeClient } from '../lib/api/envelope';
import { ApiError } from '../lib/api/client';
import { currentUserKeys } from './use-current-user';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const privacyDeletionKeys = {
  all: ['privacy-deletion'] as const,
  status: (requestId: string) =>
    [...privacyDeletionKeys.all, 'status', requestId] as const,
};

// ---------------------------------------------------------------------------
// Mutations and query sub-hooks
// ---------------------------------------------------------------------------

function useRequestDeletion() {
  return useMutation<PrivacyDeletionResponse, ApiError, undefined>({
    mutationFn: async () => {
      const envelope = await envelopeClient.post(
        '/privacy/deletion',
        { confirm: 'EXCLUIR' },
        PrivacyDeletionResponseEnvelopeSchema,
      );
      return envelope.data;
    },
  });
}

function useCancelDeletion() {
  return useMutation<undefined, ApiError, string>({
    mutationFn: async (requestId: string) => {
      await envelopeClient.delete(`/privacy/deletion/${requestId}`);
    },
  });
}

function useDeletionStatus(requestId: string | null) {
  return useQuery<PrivacyDeletionStatus>({
    queryKey: privacyDeletionKeys.status(requestId ?? ''),
    enabled: requestId !== null,
    queryFn: async () => {
      const envelope = await envelopeClient.get(
        `/privacy/deletion/${requestId}`,
        PrivacyDeletionStatusEnvelopeSchema,
      );
      return envelope.data;
    },
    staleTime: 1000 * 30, // 30s — status changes with BullMQ jobs
  });
}

// ---------------------------------------------------------------------------
// Combined hook — usePrivacyDeletion
// ---------------------------------------------------------------------------

export interface UsePrivacyDeletionReturn {
  /** Request account deletion (requires 'EXCLUIR' confirmation — sent internally). */
  requestDeletion: () => void;
  /** Cancel a pending deletion request within the grace period. */
  cancelDeletion: (requestId: string) => void;
  /** Active deletion request id (set after successful POST). */
  requestId: string | null;
  /** Current deletion status (null until a request is active). */
  deletionStatus: PrivacyDeletionStatus | null;
  /** ISO 8601 deadline until which cancellation is allowed. */
  cancellableUntil: string | null;
  /** ISO 8601 hard deletion deadline. */
  deletionDeadline: string | null;
  isRequestPending: boolean;
  isCancelPending: boolean;
  /** 409 = duplicate active request. */
  isDuplicateError: boolean;
  /** 422 = leader with active groups. */
  isLeaderBlocker: boolean;
  requestError: ApiError | null;
  cancelError: ApiError | null;
}

/**
 * usePrivacyDeletion — manages the full lifecycle of an account deletion request.
 *
 * 1. POST /api/v1/privacy/deletion to initiate.
 * 2. GET  /api/v1/privacy/deletion/:requestId to poll status.
 * 3. DELETE /api/v1/privacy/deletion/:requestId to cancel within grace period.
 *
 * Invalidates current-user query on cancel success so the banner re-renders.
 */
export function usePrivacyDeletion(initialRequestId?: string): UsePrivacyDeletionReturn {
  const queryClient = useQueryClient();

  // Track requestId in component state via mutation onSuccess
  // We use a ref-like pattern: the hook is stateless across re-renders by
  // delegating state to mutation result data.
  const requestMutation = useRequestDeletion();
  const cancelMutation = useCancelDeletion();

  // Derive active requestId: prefer mutation result, fallback to prop
  const requestId = requestMutation.data?.requestId ?? initialRequestId ?? null;

  const statusQuery = useDeletionStatus(requestId);

  const requestDeletion = () => {
    requestMutation.mutate(undefined, {
      onSuccess: () => {
        // Invalidate current user so status change is reflected in banner
        void queryClient.invalidateQueries({ queryKey: currentUserKeys.me() });
      },
    });
  };

  const cancelDeletion = (id: string) => {
    cancelMutation.mutate(id, {
      onSuccess: () => {
        // Invalidate both deletion status and current user
        void queryClient.invalidateQueries({ queryKey: privacyDeletionKeys.all });
        void queryClient.invalidateQueries({ queryKey: currentUserKeys.me() });
      },
    });
  };

  const isDuplicateError =
    requestMutation.error instanceof ApiError &&
    requestMutation.error.statusCode === 409;

  const isLeaderBlocker =
    requestMutation.error instanceof ApiError &&
    requestMutation.error.statusCode === 422;

  return {
    requestDeletion,
    cancelDeletion,
    requestId,
    deletionStatus: statusQuery.data ?? null,
    cancellableUntil: requestMutation.data?.cancellableUntil ?? null,
    deletionDeadline: requestMutation.data?.deletionDeadline ?? null,
    isRequestPending: requestMutation.isPending,
    isCancelPending: cancelMutation.isPending,
    isDuplicateError,
    isLeaderBlocker,
    requestError: requestMutation.error as ApiError | null,
    cancelError: cancelMutation.error as ApiError | null,
  };
}
