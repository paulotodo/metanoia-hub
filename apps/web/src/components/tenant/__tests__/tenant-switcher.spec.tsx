import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { MyTenantsResponse } from '@metanoia/types';
import { server } from '../../../../mocks/server';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { TenantSwitcher } from '../tenant-switcher';

const STORAGE_KEY = 'metanoia:activeTenantId';

const TENANT_A = '019756d0-0001-7000-8000-000000000001';
const TENANT_B = '019756d0-0001-7000-8000-000000000002';

async function renderSwitcher(initialActive?: string) {
  if (initialActive) window.localStorage.setItem(STORAGE_KEY, initialActive);
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Wrapper>
        <TenantSwitcher />
      </Wrapper>,
    );
  });
  return result;
}

describe('TenantSwitcher', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing when user has fewer than 2 tenants', async () => {
    server.use(
      http.get('*/api/v1/auth/my-tenants', () =>
        HttpResponse.json<MyTenantsResponse>({
          data: [
            {
              tenantId: TENANT_A,
              churchName: 'Igreja Única',
              userRole: 'leader',
              lastVisit: null,
            },
          ],
        }),
      ),
    );
    await renderSwitcher();
    await waitFor(() => {
      expect(screen.queryByTestId('tenant-switcher-trigger')).toBeNull();
    });
  });

  it('shows trigger with active tenant name when 2+ tenants', async () => {
    await renderSwitcher(TENANT_B);
    expect(await screen.findByText('Comunidade Graça')).toBeDefined();
    expect(screen.getByTestId('tenant-switcher-trigger')).toBeDefined();
  });

  it('falls back to first tenant when no active stored', async () => {
    await renderSwitcher();
    expect(await screen.findByText('Igreja Batista Central')).toBeDefined();
  });

  it('opens overlay with list and shows active badge on current tenant', async () => {
    await renderSwitcher(TENANT_A);
    const trigger = await screen.findByTestId('tenant-switcher-trigger');
    fireEvent.click(trigger);
    expect(await screen.findByTestId('tenant-switcher-list')).toBeDefined();
    expect(screen.getByTestId('tenant-switcher-active-badge')).toBeDefined();
  });

  it('switches tenant and closes overlay on selection', async () => {
    await renderSwitcher(TENANT_A);
    fireEvent.click(await screen.findByTestId('tenant-switcher-trigger'));
    const otherItem = await screen.findByTestId(
      `tenant-switcher-item-${TENANT_B}`,
    );
    fireEvent.click(otherItem);
    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(TENANT_B);
    });
  });
});
