/**
 * Story 7-6 — minimal retry wrapper for seed-time HTTP calls.
 *
 * Keycloak's `start-dev --import-realm` hits "ready" before its listeners
 * fully accept REST traffic, so the first few requests after CI boot
 * intermittently fail with connection-reset / 503. A single retry would
 * already cover ~95% of those, but we expose attempts/baseMs as opts to
 * keep the spec deterministic.
 *
 * Not wired to general API calls — only the seed scripts opt in, because
 * production callers should surface errors immediately instead of stalling.
 */

export interface RetryOptions {
  /** Total attempts (initial + retries). Default 3. */
  attempts?: number;
  /** Base delay in ms; backoff is `baseMs * 2^(attempt-1)`. Default 500. */
  baseMs?: number;
  /** Diagnostic label printed alongside retry warnings. */
  label?: string;
  /** Sleep impl, overridable for tests. Default `setTimeout`-backed. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 500;
  const label = opts.label ?? 'operation';
  const sleep = opts.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = baseMs * 2 ** (attempt - 1);
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[demo-seed] retry attempt ${attempt}/${attempts} for ${label} after ${delay}ms: ${message}`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
}
