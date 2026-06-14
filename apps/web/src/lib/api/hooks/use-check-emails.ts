'use client';

/**
 * use-check-emails.ts
 * TanStack Query hook for GET /api/v1/users/check-emails.
 *
 * Batches emails in groups of ≤500 (FR-20).
 * Partial failure (API-09-G1): failed batch → exists: false + partialCheckWarning: true.
 * Graceful degradation (FR-21): timeout/5xx → empty array + apiUnavailable: true.
 * Response validated with checkEmailsResponseSchema (Princípio IV).
 */

import { useQuery } from '@tanstack/react-query';
import { checkEmailsResponseSchema } from '@metanoia/types';
import { ApiError } from '../client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailCheckResult {
  email: string;
  /** true = already a member of this tenant */
  exists: boolean;
  /** true when the result came from a failed batch (fallback: false) */
  unverified?: boolean;
}

export interface UseCheckEmailsResult {
  results: EmailCheckResult[];
  /** true if at least one batch failed (results for that batch are unverified) */
  partialCheckWarning: boolean;
  /** true if all batches failed (API unavailable) */
  apiUnavailable: boolean;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('accessToken');
}

async function checkEmailsBatch(
  emails: string[],
): Promise<{ email: string; exists: boolean }[]> {
  const token = getAccessToken();
  const params = new URLSearchParams({ emails: emails.join(',') });

  const response = await fetch(
    `${BASE_URL}/users/check-emails?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // 10s timeout via AbortController (FR-21)
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { error?: string }).error ?? 'UnknownError',
      (body as { message?: string }).message ?? 'Erro inesperado',
    );
  }

  const json = await response.json();
  // Validate with shared schema (Princípio IV)
  const parsed = checkEmailsResponseSchema.parse(json);
  return parsed.data.results;
}

// ---------------------------------------------------------------------------
// Multi-batch aggregator
// ---------------------------------------------------------------------------

async function checkAllEmails(
  emails: string[],
): Promise<UseCheckEmailsResult> {
  if (emails.length === 0) {
    return { results: [], partialCheckWarning: false, apiUnavailable: false };
  }

  const normalizedEmails = emails.map((e) => e.trim().toLowerCase());

  // Split into batches of ≤500
  const batches: string[][] = [];
  for (let i = 0; i < normalizedEmails.length; i += BATCH_SIZE) {
    batches.push(normalizedEmails.slice(i, i + BATCH_SIZE));
  }

  const results: EmailCheckResult[] = [];
  let partialCheckWarning = false;
  let failedBatches = 0;

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const batchResults = await checkEmailsBatch(batch);
        // Preserve order: map by email from response
        const resultMap = new Map(batchResults.map((r) => [r.email, r.exists]));
        for (const email of batch) {
          results.push({
            email,
            exists: resultMap.get(email) ?? false,
          });
        }
      } catch {
        // API-09-G1: partial failure → mark batch as unverified (exists: false)
        failedBatches++;
        partialCheckWarning = true;
        for (const email of batch) {
          results.push({ email, exists: false, unverified: true });
        }
      }
    }),
  );

  const apiUnavailable = failedBatches === batches.length;

  // Re-sort results to match original input order
  const orderMap = new Map(normalizedEmails.map((e, i) => [e, i]));
  results.sort(
    (a, b) => (orderMap.get(a.email) ?? 0) - (orderMap.get(b.email) ?? 0),
  );

  return { results, partialCheckWarning, apiUnavailable };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Checks which of the provided emails already exist as members in the current tenant.
 *
 * - Enabled only when `emails` is non-empty.
 * - Batches into ≤500-email requests automatically.
 * - Graceful degradation: API down → `{ apiUnavailable: true, results: [] }`.
 *
 * Must be used in a Client Component ('use client').
 */
export function useCheckEmails(emails: string[]) {
  const dedupedEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];

  return useQuery<UseCheckEmailsResult, Error>({
    queryKey: ['users', 'check-emails', dedupedEmails],
    queryFn: () => checkAllEmails(dedupedEmails),
    enabled: dedupedEmails.length > 0,
    staleTime: 1000 * 60, // 1 min
    retry: false, // batch-level retry is handled internally (FR-21)
  });
}
