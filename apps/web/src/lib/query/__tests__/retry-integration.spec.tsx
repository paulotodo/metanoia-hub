import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { ApiError } from '../../api/client';
import { shouldRetryQuery, exponentialRetryDelay } from '../retry-policy';

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        // Use 0 in tests to make assertions fast — production uses exponential.
        retryDelay: 0,
      },
    },
  });
}

describe('TanStack Query retry policy (integration)', () => {
  it('retries 3 times on network failure and surfaces the error', async () => {
    const queryFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = makeClient();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['network-fail'],
          queryFn,
        }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 3_000,
    });

    // 1 initial + 3 retries = 4 invocations
    expect(queryFn).toHaveBeenCalledTimes(4);
    expect(result.current.error).toBeInstanceOf(TypeError);
  });

  it('does NOT retry 4xx ApiError (1 attempt, no retries)', async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValue(new ApiError(403, 'Forbidden', 'no'));
    const client = makeClient();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['forbidden'],
          queryFn,
        }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 1_000,
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx ApiError up to the cap', async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValue(new ApiError(503, 'ServiceUnavailable', 'down'));
    const client = makeClient();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['unavailable'],
          queryFn,
        }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 3_000,
    });

    expect(queryFn).toHaveBeenCalledTimes(4);
  });

  it('succeeds when a transient failure recovers within retry budget', async () => {
    let attempts = 0;
    const queryFn = vi.fn().mockImplementation(() => {
      attempts += 1;
      if (attempts < 3) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve({ ok: true });
    });
    const client = makeClient();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['transient'],
          queryFn,
        }),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 3_000,
    });
    expect(result.current.data).toEqual({ ok: true });
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('retryDelay sequence is 1s, 2s, 4s (production timings)', () => {
    expect(exponentialRetryDelay(0)).toBe(1_000);
    expect(exponentialRetryDelay(1)).toBe(2_000);
    expect(exponentialRetryDelay(2)).toBe(4_000);
  });
});
