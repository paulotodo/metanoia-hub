import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GruposPage from './page';
import * as groupsHooks from '../../../../../src/lib/api/hooks/use-groups';
import * as onboardingHooks from '../../../../../src/lib/api/hooks/use-onboarding';
import type { GroupsListResponse } from '@metanoia/types';

function withQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

const DEMO_GROUP_ID = '019756c0-2000-7000-8000-000000000002';
const REAL_GROUP_ID = '019756c0-2000-7000-8000-000000000001';
const TENANT_ID = '019756b0-1000-7000-8000-000000000001';

const MOCK_GROUPS_LIST: GroupsListResponse = {
  data: [
    {
      id: DEMO_GROUP_ID,
      tenantId: TENANT_ID,
      name: 'Grupo Alpha (exemplo)',
      dayOfWeek: 'wed',
      time: '19:30',
      recurrence: 'weekly',
      notes: 'Dados de demonstracao',
      isDemoData: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: REAL_GROUP_ID,
      tenantId: TENANT_ID,
      name: 'Celula de Quinta',
      dayOfWeek: 'thu',
      time: '19:30',
      recurrence: 'weekly',
      notes: null,
      isDemoData: false,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
  ],
  meta: { total: 2 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  // Stub DemoDataNudge hooks to avoid fetch calls in unit tests
  vi.spyOn(onboardingHooks, 'useDemoStatus').mockReturnValue({
    data: { hasDemoData: true, hasRealData: true, demoRecordCount: 1, nudgeDismissed: false },
  } as never);
  vi.spyOn(onboardingHooks, 'useDeleteDemoData').mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.spyOn(onboardingHooks, 'useDismissDemoNudge').mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
});

describe('GruposPage — DemoOverlay integration', () => {
  it('wraps demo group in DemoOverlay (shows overlay badge)', () => {
    vi.spyOn(groupsHooks, 'useGroupsList').mockReturnValue({
      data: MOCK_GROUPS_LIST,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(withQuery(<GruposPage />));

    // DemoOverlay badge should appear for demo group
    const badges = screen.getAllByText('Dados de exemplo');
    expect(badges.length).toBeGreaterThan(0);

    // Both groups rendered
    expect(screen.getByText('Grupo Alpha (exemplo)')).toBeTruthy();
    expect(screen.getByText('Celula de Quinta')).toBeTruthy();
  });

  it('does NOT wrap real group in DemoOverlay', () => {
    const realGroup = MOCK_GROUPS_LIST.data.find((g) => !g.isDemoData);
    if (!realGroup) throw new Error('Expected a real group in mock data');

    vi.spyOn(groupsHooks, 'useGroupsList').mockReturnValue({
      data: {
        data: [realGroup],
        meta: { total: 1 },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(withQuery(<GruposPage />));

    // No demo badge for a real group
    expect(screen.queryByText('Dados de exemplo')).toBeNull();
    expect(screen.getByText('Celula de Quinta')).toBeTruthy();
  });

  it('shows loading state while fetching', () => {
    vi.spyOn(groupsHooks, 'useGroupsList').mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(withQuery(<GruposPage />));
    expect(screen.getByText('Carregando grupos...')).toBeTruthy();
  });

  it('shows error state on fetch failure', () => {
    vi.spyOn(groupsHooks, 'useGroupsList').mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    } as never);

    render(withQuery(<GruposPage />));
    expect(
      screen.getByText('Nao foi possivel carregar os grupos. Tente novamente.'),
    ).toBeTruthy();
  });
});
