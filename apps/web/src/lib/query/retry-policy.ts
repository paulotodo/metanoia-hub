import { ApiError } from '../api/client';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 4_000;

/**
 * Decides whether TanStack Query should retry a failed query.
 *
 * Retries up to {@link MAX_RETRIES} attempts, EXCEPT for client errors
 * (4xx) which signal a deterministic problem the user must fix —
 * retrying them would only burn time and confuse the UI.
 *
 * Network errors (TypeError on fetch) and 5xx responses ARE retried.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;

  if (error instanceof ApiError) {
    if (error.statusCode >= 400 && error.statusCode < 500) return false;
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
