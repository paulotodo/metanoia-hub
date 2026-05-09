import { ApiError } from '../api/client';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 4_000;

/**
 * 4xx codes that ARE retryable per RFC 7231/6585 — the request is
 * structurally valid, the server is just temporarily refusing it.
 *   - 408 Request Timeout
 *   - 425 Too Early
 *   - 429 Too Many Requests
 */
const RETRYABLE_4XX = new Set([408, 425, 429]);

/**
 * Decides whether TanStack Query should retry a failed query.
 *
 * Retries up to {@link MAX_RETRIES} attempts:
 *   - Network errors (TypeError on fetch) → retry
 *   - 5xx responses → retry
 *   - 408 / 425 / 429 → retry (transient)
 *   - Other 4xx → no retry (deterministic — user must fix)
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;

  if (error instanceof ApiError) {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return RETRYABLE_4XX.has(error.statusCode);
    }
    return true;
  }

  return true;
}

/**
 * Exponential backoff capped at {@link MAX_DELAY_MS}.
 * Sequence: 1s, 2s, 4s (4s, 4s, ...) for attempts 0, 1, 2, ...
 */
export function exponentialRetryDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
}

export const RETRY_POLICY = {
  retry: shouldRetryQuery,
  retryDelay: exponentialRetryDelay,
  maxRetries: MAX_RETRIES,
} as const;
