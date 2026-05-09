import type { ClientErrorReport } from '@metanoia/types';
import { ApiError } from '../api/client';

const ENDPOINT = '/api/v1/observability/client-errors';
const TIMEOUT_MS = 3_000;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const REPORT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '') + ENDPOINT;

export interface ReportErrorContext {
  route?: string;
  componentStack?: string;
  digest?: string;
  userId?: string;
  tenantId?: string;
}

function describeError(error: unknown): {
  errorName: string;
  message: string;
  statusCode?: number;
} {
  if (error instanceof ApiError) {
    return {
      errorName: error.error,
      message: error.message,
      statusCode: error.statusCode,
    };
  }
  if (error instanceof Error) {
    return {
      errorName: error.name || 'Error',
      message: error.message || 'unknown',
    };
  }
  return { errorName: 'Unknown', message: String(error) };
}

/**
 * Send a frontend error to the API so it can be captured by Sentry.
 *
 * Uses {@link navigator.sendBeacon} when available (survives page unloads)
 * with a `fetch` fallback for older browsers. Errors during reporting are
 * swallowed — telemetry must never crash the boundary that's already
 * trying to recover from a crash.
 */
export function reportError(
  error: unknown,
  context: ReportErrorContext = {},
): void {
  if (typeof window === 'undefined') {
    // Server-side errors are already covered by the NestJS Sentry filter.
    console.error('[reportError]', error, context);
    return;
  }

  const described = describeError(error);
  const payload: ClientErrorReport = {
    errorName: described.errorName,
    message: described.message.slice(0, 500),
    ...(described.statusCode != null && { statusCode: described.statusCode }),
    ...(context.route && { route: context.route.slice(0, 500) }),
    ...(context.componentStack && {
      componentStack: context.componentStack.slice(0, 2_000),
    }),
    ...(context.digest && { digest: context.digest }),
    ...(context.userId && { userId: context.userId }),
    ...(context.tenantId && { tenantId: context.tenantId }),
    timestamp: new Date().toISOString(),
  };

  console.error('[reportError]', payload);

  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      });
      const ok = navigator.sendBeacon(REPORT_URL, blob);
      if (ok) return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: controller.signal,
    })
      .catch(() => {
        // Telemetry failure must not surface to user.
      })
      .finally(() => clearTimeout(timer));
  } catch {
    // Reporting must never throw.
  }
}
