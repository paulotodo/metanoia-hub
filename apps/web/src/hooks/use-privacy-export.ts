'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  PrivacyExportJobEnvelopeSchema,
  PrivacyExportStatusEnvelopeSchema,
  type PrivacyExportJobResponse,
  type PrivacyExportStatus,
} from '@metanoia/types';
import { envelopeClient } from '../lib/api/envelope';
import { ApiError } from '../lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const privacyExportKeys = {
  all: ['privacy-export'] as const,
  status: (jobId: string) => [...privacyExportKeys.all, 'status', jobId] as const,
};

// ---------------------------------------------------------------------------
// useRequestExport — mutation that posts to POST /api/v1/privacy/export
// ---------------------------------------------------------------------------

function useRequestExport() {
  return useMutation<PrivacyExportJobResponse, ApiError, 'json' | 'pdf'>({
    mutationFn: async (format) => {
      const envelope = await envelopeClient.post(
        '/privacy/export',
        { format },
        PrivacyExportJobEnvelopeSchema,
      );
      return envelope.data;
    },
  });
}

// ---------------------------------------------------------------------------
// useExportStatus — query with polling until terminal state
// ---------------------------------------------------------------------------

function useExportStatus(jobId: string | null) {
  return useQuery<PrivacyExportStatus>({
    queryKey: privacyExportKeys.status(jobId ?? ''),
    enabled: jobId !== null,
    queryFn: async () => {
      const envelope = await envelopeClient.get(
        `/privacy/export/${jobId}`,
        PrivacyExportStatusEnvelopeSchema,
      );
      return envelope.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 5_000;
    },
  });
}

// ---------------------------------------------------------------------------
// Combined hook — usePrivacyExport
// ---------------------------------------------------------------------------

export interface UsePrivacyExportReturn {
  requestExport: (format: 'json' | 'pdf') => void;
  jobId: string | null;
  status: PrivacyExportStatus['status'] | null;
  signedUrl: string | null;
  isPolling: boolean;
  error: ApiError | null;
  isDuplicateError: boolean;
}

/**
 * usePrivacyExport — manages the full lifecycle of a personal data export.
 *
 * 1. Initiates export via POST /api/v1/privacy/export.
 * 2. Polls GET /api/v1/privacy/export/:jobId every 5s until completed/failed.
 * 3. Exposes status, signedUrl, and error state to the component.
 */
export function usePrivacyExport(): UsePrivacyExportReturn {
  const [jobId, setJobId] = useState<string | null>(null);

  const requestMutation = useRequestExport();
  const statusQuery = useExportStatus(jobId);

  const requestExport = (format: 'json' | 'pdf') => {
    requestMutation.mutate(format, {
      onSuccess: (data) => {
        setJobId(data.jobId);
      },
    });
  };

  const currentStatus = statusQuery.data?.status ?? null;
  const isPolling =
    jobId !== null &&
    currentStatus !== 'completed' &&
    currentStatus !== 'failed';

  const error = (requestMutation.error ?? statusQuery.error) as ApiError | null;
  const isDuplicateError =
    requestMutation.error instanceof ApiError &&
    requestMutation.error.statusCode === 409;

  return {
    requestExport,
    jobId,
    status: currentStatus,
    signedUrl: statusQuery.data?.signedUrl ?? null,
    isPolling,
    error,
    isDuplicateError,
  };
}
