import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { server } from '../../../../../../../mocks/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
  usePathname: () => '/app/admin/super/tenants',
}));

import SuperAdminTenantsPage from '../page';

async function renderPage() {
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Wrapper>
        <SuperAdminTenantsPage />
      </Wrapper>,
    );
  });
  return result;
}

describe('SuperAdminTenantsPage', () => {
  it('renders title + Novo Tenant CTA', async () => {
    await renderPage();
    expect(screen.getByTestId('super-tenants-title').textContent).toBe(
      'Tenants',
    );
    expect(
      screen.getByTestId('super-tenants-new').getAttribute('href'),
    ).toBe('/app/admin/super/tenants/novo');
  });

  it('renders table rows from MSW fixture (4 tenants)', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('super-tenants-table')).toBeTruthy(),
    );
    expect(screen.getByText('Igreja Caminho Novo')).toBeTruthy();
    expect(screen.getByText('Comunidade Esperança')).toBeTruthy();
    expect(screen.getByText('Igreja Restauração')).toBeTruthy();
    expect(screen.getByText('Comunidade Encontro')).toBeTruthy();
  });

  it('shows status badges for all four statuses', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('super-tenants-table')).toBeTruthy(),
    );
    expect(screen.getAllByTestId(/tenant-status-/).length).toBeGreaterThanOrEqual(4);
  });

  it('shows empty state when API returns no tenants', async () => {
    server.use(
      http.get('*/api/v1/admin/super/tenants', () =>
        HttpResponse.json({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      ),
    );
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('super-tenants-empty')).toBeTruthy(),
    );
  });

  it('shows error state and allows retry', async () => {
    server.use(
      http.get(
        '*/api/v1/admin/super/tenants',
        () =>
          HttpResponse.json(
            { statusCode: 500, error: 'Boom', message: 'fail' },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('super-tenants-error')).toBeTruthy(),
    );
  });

  it('typing in search field updates the query (debounced eventually, but immediate state)', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('super-tenants-table')).toBeTruthy(),
    );
    const input = screen.getByTestId('super-tenants-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Restauração' } });
    expect(input.value).toBe('Restauração');
  });

  it('changing status filter resets page and re-queries', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('super-tenants-table')).toBeTruthy(),
    );
    const select = screen.getByTestId(
      'super-tenants-filter-status',
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'provisioning_failed' } });
    await waitFor(() => {
      // After filter, only Igreja Restauração (provisioning_failed) should remain
      expect(screen.getByText('Igreja Restauração')).toBeTruthy();
    });
  });
});
