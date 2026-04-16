import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../mocks/server';
import {
  pastoralAdminKeys,
  useCreateOutreachIntent,
  useDeleteOutreachIntent,
  useGroupTimeline,
  useGroupsAggregated,
  useLeaderView,
  useUpdateOutreachIntent,
} from '../use-pastoral-admin';

const GROUP_ID = '019756c0-0001-7000-8000-000000000001';
const LEADER_ID = '019756c0-0002-7000-8000-000000000001';
const INTENT_ID = '019756c0-0003-7000-8000-000000000001';

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper };
}

describe('useGroupsAggregated', () => {
  it('fetches validated church overview', async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useGroupsAggregated(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data?.data).toBeInstanceOf(Array);
    expect((data?.data.length ?? 0) > 0).toBe(true);
    expect(data?.meta.groupCount).toBe(data?.data.length);
    expect(data?.data[0]?.status).toMatch(
      /^(healthy|attention|call|no-signal)$/,
    );
  });
});

describe('useGroupTimeline', () => {
  it('fetches group timeline when groupId is provided', async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useGroupTimeline(GROUP_ID), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data?.data.group.groupId).toBeDefined();
    expect(data?.data.entries).toBeInstanceOf(Array);
    expect(data?.meta.windowStart).toBeDefined();
    expect(data?.meta.windowEnd).toBeDefined();
  });

  it('does not fetch when groupId is empty', () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useGroupTimeline(''), { wrapper });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.isSuccess).toBe(false);
  });
});

describe('useLeaderView', () => {
  it('fetches validated leader view', async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useLeaderView(LEADER_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data?.data.leader.leaderId).toBeDefined();
    expect(data?.data.leader.fullName).toBeDefined();
    expect(data?.data.leader.groupName).toBeDefined();
    expect(data?.data.recentActivity).toBeInstanceOf(Array);
  });
});

describe('useCreateOutreachIntent', () => {
  it('creates intent and invalidates leader query', async () => {
    const { queryClient, wrapper } = createHarness();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateOutreachIntent(LEADER_ID), {
      wrapper,
    });

    result.current.mutate({
      targetLeaderId: LEADER_ID,
      weekOf: '2026-04-13T00:00:00.000Z',
      note: 'Ligar esta semana.',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: pastoralAdminKeys.leader(LEADER_ID),
    });
  });
});

describe('useUpdateOutreachIntent', () => {
  it('updates intent and invalidates leader query', async () => {
    const { queryClient, wrapper } = createHarness();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateOutreachIntent(LEADER_ID), {
      wrapper,
    });

    result.current.mutate({
      intentId: INTENT_ID,
      body: { note: 'Nova nota.' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: pastoralAdminKeys.leader(LEADER_ID),
    });
  });
});

describe('useDeleteOutreachIntent', () => {
  it('deletes intent (204) and invalidates leader query', async () => {
    const { queryClient, wrapper } = createHarness();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteOutreachIntent(LEADER_ID), {
      wrapper,
    });

    result.current.mutate(INTENT_ID);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: pastoralAdminKeys.leader(LEADER_ID),
    });
  });
});

describe('envelopeClient error handling', () => {
  it('surfaces backend 500 as error', async () => {
    server.use(
      http.get('*/api/v1/admin/church/overview', () =>
        HttpResponse.json(
          { error: 'InternalError', message: 'Falha ao carregar' },
          { status: 500 },
        ),
      ),
    );

    const { wrapper } = createHarness();
    const { result } = renderHook(() => useGroupsAggregated(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

describe('envelopeClient auth header', () => {
  beforeEach(() => {
    window.sessionStorage.setItem('accessToken', 'test-bearer-token');
  });

  afterEach(() => {
    window.sessionStorage.removeItem('accessToken');
  });

  it('sends Authorization: Bearer when accessToken is in sessionStorage', async () => {
    const seen: { auth: string | null } = { auth: null };

    server.use(
      http.get('*/api/v1/admin/church/overview', ({ request }) => {
        seen.auth = request.headers.get('authorization');
        return HttpResponse.json({
          data: [],
          meta: {
            lastCalculatedAt: '2026-04-15T06:00:00.000Z',
            groupCount: 0,
          },
        });
      }),
    );

    const { wrapper } = createHarness();
    const { result } = renderHook(() => useGroupsAggregated(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(seen.auth).toBe('Bearer test-bearer-token');
  });
});
