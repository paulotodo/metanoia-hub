import { act, render, waitFor, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';

const TENANT_ID = '019800a0-0000-7000-8000-000000000001';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({ id: TENANT_ID }),
  usePathname: () => `/app/admin/super/tenants`,
}));

import SuperAdminTenantsPage from '../page';
import NewTenantPage from '../novo/page';
import TenantDetailPage from '../[id]/page';

async function renderPage(node: React.ReactElement) {
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<Wrapper>{node}</Wrapper>);
  });
  return result;
}

const axeOptions = {
  // heading-order disabled: páginas isoladas não têm o h1 do layout autenticado.
  rules: { 'heading-order': { enabled: false } },
};

describe('Cenário 09 — accessibility (jest-axe)', () => {
  it('09.2 dashboard tenants page has no a11y violations (loaded)', async () => {
    const { container } = await renderPage(<SuperAdminTenantsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('super-tenants-table')).toBeTruthy(),
    );
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('09.3 provision page has no a11y violations (form state)', async () => {
    const { container } = await renderPage(<NewTenantPage />);
    await waitFor(() =>
      expect(screen.getByTestId('provision-form')).toBeTruthy(),
    );
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('09.4 detail page has no a11y violations (loaded)', async () => {
    const { container } = await renderPage(<TenantDetailPage />);
    await waitFor(() =>
      expect(screen.getByTestId('tenant-detail-info-card')).toBeTruthy(),
    );
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });
});
