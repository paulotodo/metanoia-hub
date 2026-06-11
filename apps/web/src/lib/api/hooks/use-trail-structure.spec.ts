/**
 * use-trail-structure.spec.ts — T12
 * Ref: tasks.md §2.1.7, §6.2, spec §FR-010, dec-006 (parallel fetch, staleTime 5min).
 *
 * T12: verify staleTime=300_000 in hook config;
 *      verify that 2 calls within 5min produce 1 fetch (dedup via MSW call count).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import {
  useTrail,
  useTrailModules,
  useModuleLessons,
  trailStructureKeys,
} from './use-trail-structure';
import {
  MOCK_TRAIL_ID,
  MOCK_MODULE_A_ID,
  mockTrail,
} from '@test-mocks/handlers/trail-structure';
import React from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

// ---------------------------------------------------------------------------
// T12: staleTime and fetch dedup
// ---------------------------------------------------------------------------

describe('use-trail-structure — T12 staleTime + dedup', () => {
  it('T12-staletime: useTrail has staleTime 300_000 in query config', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useTrail(MOCK_TRAIL_ID), { wrapper });
    await waitFor(() => result.current.isSuccess);

    // Verify the query observer recorded staleTime = 300_000
    // The query cache stores the options; check via getObserversCount and the query object
    const query = qc.getQueryCache().find({ queryKey: trailStructureKeys.trail(MOCK_TRAIL_ID) });
    expect(query).toBeDefined();
    // Query staleTime can be read from the query's defaulted options
    // (TanStack Query v5 stores it in query.options.staleTime)
    expect((query as { options?: { staleTime?: number } })?.options?.staleTime).toBe(300_000);
  });

  it('T12-dedup: 2 renders of useTrail within staleTime produce 1 fetch', async () => {
    let fetchCount = 0;
    server.use(
      http.get('*/api/v1/trails/:trailId', () => {
        fetchCount++;
        return HttpResponse.json({ data: mockTrail });
      }),
    );

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(qc);

    // First render
    const { result: r1 } = renderHook(() => useTrail(MOCK_TRAIL_ID), { wrapper });
    await waitFor(() => r1.current.isSuccess);

    const countAfterFirst = fetchCount;

    // Second render — same QueryClient, data still fresh (stale=false)
    const { result: r2 } = renderHook(() => useTrail(MOCK_TRAIL_ID), { wrapper });
    // Short wait to allow any potential extra fetch
    await new Promise((r) => setTimeout(r, 50));

    // Should not have fetched again (cache hit — same query key, data fresh)
    expect(fetchCount).toBe(countAfterFirst);
    expect(r2.current.isSuccess).toBe(true);
  });

  it('T12-modules-staletime: useTrailModules has staleTime 300_000 and returns data', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useTrailModules(MOCK_TRAIL_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = qc.getQueryCache().find({
      queryKey: trailStructureKeys.modules(MOCK_TRAIL_ID),
    });
    expect((query as { options?: { staleTime?: number } })?.options?.staleTime).toBe(300_000);
    expect(result.current.data?.data).toBeDefined();
    expect(result.current.data?.data.length).toBeGreaterThan(0);
  });

  it('T12-lessons-staletime: useModuleLessons has staleTime 300_000 and returns data', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(
      () => useModuleLessons(MOCK_TRAIL_ID, MOCK_MODULE_A_ID),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = qc.getQueryCache().find({
      queryKey: trailStructureKeys.lessons(MOCK_TRAIL_ID, MOCK_MODULE_A_ID),
    });
    expect((query as { options?: { staleTime?: number } })?.options?.staleTime).toBe(300_000);
    expect(result.current.data?.data).toBeDefined();
    expect(result.current.data?.data.length).toBeGreaterThan(0);
  });

  it('T12-disabled-when-no-trailId: useTrail does not fetch when trailId is empty', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useTrail(''), { wrapper });
    // Should remain in idle/pending state without fetching
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('T12-query-keys: trailStructureKeys match expected patterns', () => {
    expect(trailStructureKeys.trail('abc')).toEqual(['trail-structure', 'trail', 'abc']);
    expect(trailStructureKeys.modules('abc')).toEqual(['trail-structure', 'modules', 'abc']);
    expect(trailStructureKeys.lessons('abc', 'xyz')).toEqual([
      'trail-structure',
      'lessons',
      'abc',
      'xyz',
    ]);
  });
});
