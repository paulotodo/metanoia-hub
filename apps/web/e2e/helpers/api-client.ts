import type { APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL } from '../setup/env';

/**
 * Thin wrapper over Playwright's APIRequestContext that prefixes the Next
 * front-door base URL (port 3000) so requests flow through the
 * `/api/v1/:path*` rewrite declared in `apps/web/next.config.ts`, exercising
 * the exact same path a browser client uses. It attaches the Bearer token
 * (frontend stores access tokens in sessionStorage rather than cookies, so
 * `page.request` does NOT carry authentication automatically) and surfaces
 * non-OK responses with the response body for easier debugging.
 */
export interface ApiResponse<T> {
  status: number;
  data: T;
}

export interface ApiCallOptions {
  bearerToken?: string;
}

function buildHeaders(options?: ApiCallOptions): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.bearerToken) {
    headers.Authorization = `Bearer ${options.bearerToken}`;
  }
  return headers;
}

export async function apiPost<TBody, TResponse>(
  request: APIRequestContext,
  path: string,
  body: TBody,
  options?: ApiCallOptions,
): Promise<ApiResponse<TResponse>> {
  const url = `${E2E_BASE_URL}${path}`;
  const response = await request.post(url, {
    data: body as unknown as Record<string, unknown>,
    headers: buildHeaders(options),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response from ${url} (${response.status()}): ${text.slice(0, 200)}`);
  }

  if (!response.ok()) {
    throw new Error(
      `POST ${url} failed (${response.status()}): ${redactSecrets(parsed).slice(0, 300)}`,
    );
  }

  return { status: response.status(), data: parsed as TResponse };
}

const SECRET_KEYS = new Set([
  'accesstoken',
  'refreshtoken',
  'sessionid',
  'authorization',
  'password',
  'token',
]);

function redactSecrets(value: unknown): string {
  return JSON.stringify(value, (key, val) => {
    if (typeof key === 'string' && SECRET_KEYS.has(key.toLowerCase())) {
      return '[REDACTED]';
    }
    return val as unknown;
  });
}
