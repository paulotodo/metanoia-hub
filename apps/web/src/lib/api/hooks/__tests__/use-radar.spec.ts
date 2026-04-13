import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  useRadarPage,
  useSignalDetail,
  useParticipantProfile,
  useRecordCareAction,
} from '../use-radar';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useRadarPage', () => {
  it('fetches and returns validated radar page data', async () => {
    const { result } = renderHook(() => useRadarPage(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.participants).toBeInstanceOf(Array);
    expect((data?.participants.length ?? 0) > 0).toBe(true);
    expect(data?.groups).toBeInstanceOf(Array);
    expect(data?.signalCounts).toBeDefined();
    expect(data?.userFirstName).toBeDefined();
  });
});

describe('useSignalDetail', () => {
  it('fetches and returns validated signal detail', async () => {
    const { result } = renderHook(
      () => useSignalDetail('019756a1-1001-7000-8000-000000000001'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.participantId).toBe(
      '019756a1-1001-7000-8000-000000000001',
    );
    expect(data?.signalType).toBeDefined();
    expect(data?.observedFact).toBeDefined();
  });

  it('does not fetch when participantId is empty', async () => {
    const { result } = renderHook(() => useSignalDetail(''), {
      wrapper: createWrapper(),
    });

    // Should stay in idle/pending state since enabled: false
    expect(result.current.isFetching).toBe(false);
  });
});

describe('useParticipantProfile', () => {
  it('fetches and returns validated participant profile', async () => {
    const { result } = renderHook(
      () => useParticipantProfile('019756a1-1001-7000-8000-000000000001'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.memory).toBeDefined();
    expect(data?.presenceDots).toBeInstanceOf(Array);
  });
});

describe('useRecordCareAction', () => {
  it('posts care action and returns response', async () => {
    const { result } = renderHook(
      () => useRecordCareAction('019756a1-1001-7000-8000-000000000001'),
      { wrapper: createWrapper() },
    );

    result.current.mutate({
      participantId: '019756a1-1001-7000-8000-000000000001',
      groupId: '019756a1-2001-7000-8000-000000000001',
      signalType: 'care-urgent',
      note: 'Vou ligar para saber como está.',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.careActionId).toBeDefined();
    expect(data?.recordedAt).toBeDefined();
  });
});
