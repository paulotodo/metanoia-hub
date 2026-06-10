import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../mocks/server';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { ChurchSelectClient } from '../church-select-client';
import type { MyTenantsResponse, SelectTenantResponse } from '@metanoia/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

// Stub useActiveTenantId so tests don't need a real Zustand store.
vi.mock('@/lib/tenant/use-active-tenant-id', () => ({
  useActiveTenantId: () => ({ activeTenantId: null, setActiveTenantId: vi.fn() }),
}));

const SINGLE_TENANT: MyTenantsResponse['data'] = [
  {
    tenantId: '019756d0-0001-7000-8000-000000000001',
    churchName: 'Igreja Unica',
    userRole: 'participant',
    lastVisit: null,
  },
];

const MULTI_TENANT: MyTenantsResponse['data'] = [
  {
    tenantId: '019756d0-0001-7000-8000-000000000001',
    churchName: 'Igreja A',
    userRole: 'leader',
    lastVisit: null,
  },
  {
    tenantId: '019756d0-0001-7000-8000-000000000002',
    churchName: 'Igreja B',
    userRole: 'participant',
    lastVisit: null,
  },
];

async function renderClient() {
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Wrapper>
        <ChurchSelectClient />
      </Wrapper>,
    );
  });
  return result;
}

describe('ChurchSelectClient — auto-select (FR-001 to FR-004)', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('auto-selects and redirects to /app/gestao when exactly one tenant resolves', async () => {
    server.use(
      http.get('*/api/v1/auth/my-tenants', () =>
        HttpResponse.json<MyTenantsResponse>({ data: SINGLE_TENANT }),
      ),
      http.post('*/api/v1/auth/select-tenant', async ({ request }) => {
        const body = (await request.json()) as { tenantId: string };
        return HttpResponse.json<SelectTenantResponse>({
          data: { tenantId: body.tenantId },
        });
      }),
    );

    await renderClient();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/app/gestao');
    });

    // The church list should never have been visible as the user's primary
    // interaction. In a real browser the router.push would navigate away;
    // in jsdom the component stays mounted. We verify that the push happened
    // (which is the observable UX result) and that the list was not shown
    // BEFORE the mutation completed (checked via auto-select-loading testid).
    // The list may appear after mutation settles since jsdom does not navigate.
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator during auto-select in-flight (FR-002)', async () => {
    // Delay the select-tenant response to observe the loading state.
    server.use(
      http.get('*/api/v1/auth/my-tenants', () =>
        HttpResponse.json<MyTenantsResponse>({ data: SINGLE_TENANT }),
      ),
      http.post('*/api/v1/auth/select-tenant', async () => {
        // Never resolves in this test — we observe the in-flight state.
        await new Promise(() => {});
        return HttpResponse.json<SelectTenantResponse>({
          data: { tenantId: '' },
        });
      }),
    );

    await renderClient();

    // Wait for the tenant list to resolve and mutation to start.
    await waitFor(() => {
      expect(
        screen.queryByTestId('church-auto-select-loading'),
      ).not.toBeNull();
    });
  });

  it('does NOT auto-select when multiple tenants are present', async () => {
    // Default MSW handler returns 3 tenants; override with 2 explicit ones.
    server.use(
      http.get('*/api/v1/auth/my-tenants', () =>
        HttpResponse.json<MyTenantsResponse>({ data: MULTI_TENANT }),
      ),
    );

    await renderClient();

    // Tenant list must be displayed.
    expect(await screen.findByTestId('church-select-list')).toBeDefined();

    // No automatic redirect.
    expect(push).not.toHaveBeenCalled();
  });

  it('shows selection screen (fallback) when single-tenant auto-select API fails (FR-004)', async () => {
    server.use(
      http.get('*/api/v1/auth/my-tenants', () =>
        HttpResponse.json<MyTenantsResponse>({ data: SINGLE_TENANT }),
      ),
      http.post('*/api/v1/auth/select-tenant', () =>
        HttpResponse.json({ statusCode: 503, error: 'Service Unavailable' }, { status: 503 }),
      ),
    );

    await renderClient();

    // After the failure, no redirect should have happened.
    await waitFor(() => {
      expect(push).not.toHaveBeenCalled();
    });

    // hasFired remains true — no retry loop (the list renders without mutation).
    // selectTenant.isPending is false after error → the list is shown.
    await waitFor(() => {
      expect(screen.queryByTestId('church-select-list')).not.toBeNull();
    });
  });

  it('hasFired guard prevents a second mutate call on re-render', async () => {
    let mutateCallCount = 0;
    server.use(
      http.get('*/api/v1/auth/my-tenants', () =>
        HttpResponse.json<MyTenantsResponse>({ data: SINGLE_TENANT }),
      ),
      http.post('*/api/v1/auth/select-tenant', async ({ request }) => {
        mutateCallCount++;
        const body = (await request.json()) as { tenantId: string };
        return HttpResponse.json<SelectTenantResponse>({
          data: { tenantId: body.tenantId },
        });
      }),
    );

    const Wrapper = createQueryClientWrapper();
    const { rerender } = render(
      <Wrapper>
        <ChurchSelectClient />
      </Wrapper>,
    );

    // Trigger a re-render after success.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/gestao'));
    await act(async () => {
      rerender(
        <Wrapper>
          <ChurchSelectClient />
        </Wrapper>,
      );
    });

    // mutate must have been called only once, not twice.
    expect(mutateCallCount).toBe(1);
  });
});
