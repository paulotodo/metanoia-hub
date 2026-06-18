import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useLeaderSummary, leaderSummaryKeys } from '../use-leader-summary';

// Mock envelopeClient
vi.mock('../../envelope', () => ({
  envelopeClient: {
    get: vi.fn(),
  },
}));

const { envelopeClient } = await import('../../envelope');

const mockResponse = {
  data: {
    groups: [
      {
        groupId: '018e3a00-0000-7000-8000-000000000001',
        groupName: 'Células Norte',
        avgAttendancePercent: 75.5,
        avgTrailProgressPercent: 60,
        atRiskCount: 2,
        activeParticipantsCount: 10,
      },
    ],
    summary: {
      totalGroups: 1,
      totalParticipants: 10,
      overallAttendancePercent: 75.5,
      overallTrailCompletionPercent: 60,
    },
  },
  meta: {
    period: '30d' as const,
    startDate: '2026-05-18T00:00:00.000Z',
    endDate: '2026-06-17T23:59:59.999Z',
  },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useLeaderSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches leader summary with default period', async () => {
    vi.mocked(envelopeClient.get).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useLeaderSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(envelopeClient.get).toHaveBeenCalledWith(
      '/reports/leader-summary',
      expect.anything(),
    );
  });

  it('builds query string with period and groupId', async () => {
    vi.mocked(envelopeClient.get).mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useLeaderSummary({ period: '7d', groupId: '018e3a00-0000-7000-8000-000000000001' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(envelopeClient.get).toHaveBeenCalledWith(
      '/reports/leader-summary?period=7d&groupId=018e3a00-0000-7000-8000-000000000001',
      expect.anything(),
    );
  });

  it('includes startDate and endDate for custom period', async () => {
    vi.mocked(envelopeClient.get).mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () =>
        useLeaderSummary({
          period: 'custom',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-03-31T23:59:59.999Z',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callUrl = vi.mocked(envelopeClient.get).mock.calls[0][0] as string;
    expect(callUrl).toContain('period=custom');
    expect(callUrl).toContain('startDate=');
    expect(callUrl).toContain('endDate=');
  });

  it('query key factory includes query params', () => {
    const key = leaderSummaryKeys.list({ period: '30d' });
    expect(key).toEqual(['leader-summary', 'list', { period: '30d' }]);
  });
});
