/**
 * use-check-emails.spec.ts
 * Unit tests for useCheckEmails hook.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';

import { useCheckEmails } from '../use-check-emails';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const API_PATTERN = /\/api\/v1\/users\/check-emails/;

/** Build the standard check-emails response for a given list of emails (all exists: false). */
function mockCheckEmailsResponse(emails: string[], existingEmails: string[] = []) {
  const existingSet = new Set(existingEmails);
  return {
    data: {
      results: emails.map((email) => ({
        email,
        exists: existingSet.has(email),
      })),
    },
    meta: {
      checkedCount: emails.length,
      tenantScoped: true as const,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCheckEmails', () => {
  beforeEach(() => {
    // Default handler: all emails → exists: false
    server.use(
      http.get(API_PATTERN, ({ request }) => {
        const url = new URL(request.url);
        const emailsParam = url.searchParams.get('emails') ?? '';
        const emails = emailsParam
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);
        return HttpResponse.json(mockCheckEmailsResponse(emails));
      }),
    );
  });

  it('returns empty results when emails list is empty (hook disabled)', () => {
    const { result } = renderHook(() => useCheckEmails([]), {
      wrapper: createWrapper(),
    });

    // Hook should be disabled (not fetching)
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it('batch ≤500 emails — single request, exists: false', async () => {
    const emails = ['a@ex.com', 'b@ex.com', 'c@ex.com'];

    const { result } = renderHook(() => useCheckEmails(emails), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.results).toHaveLength(3);
    expect(result.current.data?.apiUnavailable).toBe(false);
    expect(result.current.data?.partialCheckWarning).toBe(false);
    expect(result.current.data?.results[0]?.email).toBe('a@ex.com');
    expect(result.current.data?.results[0]?.exists).toBe(false);
  });

  it('marks email exists: true when API returns exists: true', async () => {
    const emails = ['existing@ex.com', 'new@ex.com'];

    server.use(
      http.get(API_PATTERN, () =>
        HttpResponse.json(mockCheckEmailsResponse(emails, ['existing@ex.com'])),
      ),
    );

    const { result } = renderHook(() => useCheckEmails(emails), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const existing = result.current.data?.results.find(
      (r) => r.email === 'existing@ex.com',
    );
    const newUser = result.current.data?.results.find(
      (r) => r.email === 'new@ex.com',
    );

    expect(existing?.exists).toBe(true);
    expect(newUser?.exists).toBe(false);
  });

  it('batching >500 emails — sends multiple requests, preserves order', async () => {
    const requestCounts: number[] = [];

    server.use(
      http.get(API_PATTERN, ({ request }) => {
        const url = new URL(request.url);
        const emailsParam = url.searchParams.get('emails') ?? '';
        const emails = emailsParam
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);
        requestCounts.push(emails.length);
        return HttpResponse.json(mockCheckEmailsResponse(emails));
      }),
    );

    // 501 emails to trigger 2 batches
    const emails = Array.from({ length: 501 }, (_, i) => `user${i}@ex.com`);

    const { result } = renderHook(() => useCheckEmails(emails), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should have been called in 2 batches
    expect(requestCounts).toHaveLength(2);
    expect(requestCounts[0]).toBe(500);
    expect(requestCounts[1]).toBe(1);

    // All 501 results returned
    expect(result.current.data?.results).toHaveLength(501);

    // Order preserved: first result is user0@ex.com
    expect(result.current.data?.results[0]?.email).toBe('user0@ex.com');
    expect(result.current.data?.results[500]?.email).toBe('user500@ex.com');
  });

  it('partial failure: failed batch → unverified results, partialCheckWarning: true', async () => {
    let callCount = 0;

    server.use(
      http.get(API_PATTERN, ({ request }) => {
        const url = new URL(request.url);
        const emailsParam = url.searchParams.get('emails') ?? '';
        const emails = emailsParam
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);
        callCount++;

        // Fail the second batch
        if (callCount === 2) {
          return HttpResponse.json({ error: 'Server Error' }, { status: 500 });
        }

        return HttpResponse.json(mockCheckEmailsResponse(emails));
      }),
    );

    // 1001 emails → 3 batches; batch 2 will fail
    const emails = Array.from({ length: 1001 }, (_, i) => `u${i}@ex.com`);

    const { result } = renderHook(() => useCheckEmails(emails), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.partialCheckWarning).toBe(true);
    expect(result.current.data?.apiUnavailable).toBe(false);

    // Failed batch emails should be unverified (exists: false, unverified: true)
    const unverified = result.current.data?.results.filter((r) => r.unverified);
    expect(unverified?.length).toBe(500); // batch 2 = emails 500–999
  });

  it('graceful degradation: all batches fail → apiUnavailable: true', async () => {
    server.use(
      http.get(API_PATTERN, () =>
        HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 }),
      ),
    );

    const emails = ['a@ex.com', 'b@ex.com'];

    const { result } = renderHook(() => useCheckEmails(emails), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.apiUnavailable).toBe(true);
    expect(result.current.data?.results.every((r) => r.exists === false)).toBe(true);
  });

  it('schema validation: malformed response is caught and treated as failure', async () => {
    server.use(
      http.get(API_PATTERN, () =>
        // Wrong shape — missing `data.results`
        HttpResponse.json({ wrong: 'shape' }),
      ),
    );

    const emails = ['test@ex.com'];

    const { result } = renderHook(() => useCheckEmails(emails), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Zod parse failure → batch treated as partial failure
    expect(result.current.data?.apiUnavailable).toBe(true);
  });

  it('deduplicates emails before sending', async () => {
    const requestEmails: string[] = [];

    server.use(
      http.get(API_PATTERN, ({ request }) => {
        const url = new URL(request.url);
        const emailsParam = url.searchParams.get('emails') ?? '';
        const emails = emailsParam.split(',').map((e) => e.trim()).filter(Boolean);
        requestEmails.push(...emails);
        return HttpResponse.json(mockCheckEmailsResponse(emails));
      }),
    );

    // Duplicate emails in input
    const emails = ['a@ex.com', 'A@EX.COM', 'b@ex.com', 'a@ex.com'];

    const { result } = renderHook(() => useCheckEmails(emails), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should only send unique, lowercased emails
    const uniqueSent = [...new Set(requestEmails)];
    expect(uniqueSent).toHaveLength(2);
    expect(uniqueSent).toContain('a@ex.com');
    expect(uniqueSent).toContain('b@ex.com');
  });
});
