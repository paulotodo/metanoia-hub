import { act, render, waitFor, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';

// Mock next/navigation — no router calls needed in this page
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
  usePathname: () => '/app/admin/super/audit',
}));

import SuperAuditPage from '../page';

async function renderPage(node: React.ReactElement) {
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<Wrapper>{node}</Wrapper>);
  });
  return result;
}

const axeOptions = {
  // heading-order disabled: pages rendered in isolation lack the root h1 from the layout
  rules: { 'heading-order': { enabled: false } },
};

describe('Story 9-3 — Audit Viewer accessibility (jest-axe)', () => {
  it('loaded table state has no a11y violations', async () => {
    const { container } = await renderPage(<SuperAuditPage />);
    await waitFor(() =>
      expect(screen.getByTestId('super-audit-table')).toBeTruthy(),
    );
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('skeleton loading state has no a11y violations', async () => {
    const { container } = await renderPage(<SuperAuditPage />);
    // axe runs against initial render state (may be skeleton or loaded)
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('expanded row (previousState/newState JSON panel) has no a11y violations', async () => {
    const { container } = await renderPage(<SuperAuditPage />);
    await waitFor(() =>
      expect(screen.getByTestId('super-audit-table')).toBeTruthy(),
    );

    // Expand first row by clicking "Ver detalhes"
    const expandButtons = screen.getAllByRole('button', { name: /Ver detalhes/i });
    expect(expandButtons.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(expandButtons[0]);
    });

    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });

  it('empty state has no a11y violations', async () => {
    const { server } = await import('@test-mocks/server');
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.get('*/api/v1/super-admin/audit-events', () =>
        HttpResponse.json({
          data: [],
          meta: { page: 1, perPage: 50, total: 0, totalPages: 1 },
        }),
      ),
    );

    const { container } = await renderPage(<SuperAuditPage />);
    await waitFor(() =>
      expect(screen.getByTestId('super-audit-empty')).toBeTruthy(),
    );

    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });
});
