import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { server } from '../../../../../../../../mocks/server';

let mockId = '019800a0-0000-7000-8000-000000000001'; // active
const ACTIVE_ID = '019800a0-0000-7000-8000-000000000001';
const FAILED_ID = '019800a0-0000-7000-8000-000000000003';
const SUSPENDED_ID = '019800a0-0000-7000-8000-000000000004';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: mockId }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => `/app/admin/super/tenants/${mockId}`,
}));

import TenantDetailPage from '../page';

async function renderPage(id = ACTIVE_ID) {
  mockId = id;
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Wrapper>
        <TenantDetailPage />
      </Wrapper>,
    );
  });
  return result;
}

describe('TenantDetailPage', () => {
  it('renders header, info, numbers and actions for active tenant', async () => {
    await renderPage(ACTIVE_ID);
    await waitFor(() =>
      expect(screen.getByTestId('tenant-detail-name')).toBeTruthy(),
    );
    expect(screen.getByTestId('tenant-detail-info-card')).toBeTruthy();
    expect(screen.getByTestId('tenant-detail-numbers-card')).toBeTruthy();
    expect(screen.getByTestId('tenant-detail-actions-card')).toBeTruthy();
    // Active tenant shows Suspend, NOT Reactivate / Retry
    expect(screen.queryByTestId('tenant-detail-suspend')).toBeTruthy();
    expect(screen.queryByTestId('tenant-detail-reactivate')).toBeNull();
    expect(screen.queryByTestId('tenant-detail-retry')).toBeNull();
  });

  it('shows Reactivate (not Suspend) for suspended tenant', async () => {
    await renderPage(SUSPENDED_ID);
    await waitFor(() =>
      expect(screen.getByTestId('tenant-detail-name')).toBeTruthy(),
    );
    expect(screen.queryByTestId('tenant-detail-suspend')).toBeNull();
    expect(screen.getByTestId('tenant-detail-reactivate')).toBeTruthy();
  });

  it('shows Retry for provisioning_failed tenant', async () => {
    await renderPage(FAILED_ID);
    await waitFor(() =>
      expect(screen.getByTestId('tenant-detail-name')).toBeTruthy(),
    );
    expect(screen.getByTestId('tenant-detail-retry')).toBeTruthy();
  });

  it('renders 404 error state when tenant not found', async () => {
    server.use(
      http.get('*/api/v1/admin/super/tenants/:id', () =>
        HttpResponse.json(
          { statusCode: 404, error: 'Not Found', message: 'no' },
          { status: 404 },
        ),
      ),
    );
    await renderPage('019800a0-0000-7000-8000-0000000000ee');
    await waitFor(() =>
      expect(screen.getByTestId('tenant-detail-error')).toBeTruthy(),
    );
  });

  it('opens suspend dialog and confirms', async () => {
    await renderPage(ACTIVE_ID);
    await waitFor(() =>
      expect(screen.getByTestId('tenant-detail-suspend')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('tenant-detail-suspend'));
    expect(screen.getByTestId('tenant-detail-suspend-dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tenant-detail-suspend-confirm'));
    await waitFor(() =>
      expect(screen.queryByTestId('tenant-detail-suspend-dialog')).toBeNull(),
    );
  });

  it('inline-edits the tenant name', async () => {
    await renderPage(ACTIVE_ID);
    await waitFor(() =>
      expect(screen.getByTestId('tenant-detail-edit-name')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('tenant-detail-edit-name'));
    const input = screen.getByTestId(
      'tenant-detail-name-input',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Igreja Renomeada' } });
    fireEvent.click(screen.getByTestId('tenant-detail-name-save'));
    await waitFor(() =>
      expect(screen.queryByTestId('tenant-detail-name-input')).toBeNull(),
    );
  });
});
