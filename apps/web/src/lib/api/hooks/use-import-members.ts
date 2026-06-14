'use client';

import { useMutation } from '@tanstack/react-query';
import type { ImportRequest, ImportResultSummary } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AsyncImportAccepted {
  jobId: string;
  message: string;
}

export type ImportMembersResult = ImportResultSummary | AsyncImportAccepted;

function isAsyncResult(result: ImportMembersResult): result is AsyncImportAccepted {
  return 'jobId' in result && typeof (result as AsyncImportAccepted).jobId === 'string';
}

export { isAsyncResult };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useImportMembers — TanStack mutation for POST /api/v1/groups/:groupId/members/import
 *
 * - 201 → ImportResultSummary (sync, ≤100 rows)
 * - 202 → AsyncImportAccepted { jobId, message } (async, >100 rows)
 *
 * Usage: Client Components only. Never import in Server Components.
 */
export function useImportMembers(groupId: string) {
  return useMutation<ImportMembersResult, Error, ImportRequest>({
    mutationFn: async (body: ImportRequest) => {
      const resp = await fetch(`/api/v1/groups/${groupId}/members/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = (await resp.json()) as { data?: ImportMembersResult; statusCode?: number; error?: string; message?: string };

      if (!resp.ok) {
        const msg = json.message ?? json.error ?? `Import failed (${resp.status})`;
        throw new Error(msg);
      }

      if (!json.data) {
        throw new Error('Resposta inesperada do servidor');
      }

      return json.data;
    },
  });
}
