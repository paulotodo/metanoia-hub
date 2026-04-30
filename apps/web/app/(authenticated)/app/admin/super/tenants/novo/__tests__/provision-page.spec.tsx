import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { server } from '../../../../../../../../mocks/server';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
  usePathname: () => '/app/admin/super/tenants/novo',
}));

import NewTenantPage from '../page';

async function renderPage() {
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Wrapper>
        <NewTenantPage />
      </Wrapper>,
    );
  });
  return result;
}

describe('NewTenantPage', () => {
  it('renders form with title and submit button', async () => {
    await renderPage();
    expect(screen.getByTestId('provision-title').textContent).toBe(
      'Novo Tenant',
    );
    expect(screen.getByTestId('provision-submit')).toBeTruthy();
  });

  it('auto-suggests slug from name with diacritic stripping', async () => {
    await renderPage();
    const nameInput = screen.getByTestId(
      'provision-name-input',
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Igreja Restauração' } });
    const slugInput = screen.getByTestId(
      'provision-slug-input',
    ) as HTMLInputElement;
    expect(slugInput.value).toBe('igreja-restauracao');
  });

  it('stops auto-suggesting after manual slug edit', async () => {
    await renderPage();
    const nameInput = screen.getByTestId(
      'provision-name-input',
    ) as HTMLInputElement;
    const slugInput = screen.getByTestId(
      'provision-slug-input',
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Igreja Vida Nova' } });
    expect(slugInput.value).toBe('igreja-vida-nova');
    fireEvent.change(slugInput, { target: { value: 'vida-nova-customizada' } });
    fireEvent.change(nameInput, { target: { value: 'Igreja Vida Outra' } });
    expect(slugInput.value).toBe('vida-nova-customizada');
  });

  it('shows inline validation errors on empty submit', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('provision-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('provision-name-error')).toBeTruthy(),
    );
    expect(screen.getByTestId('provision-slug-error')).toBeTruthy();
    expect(screen.getByTestId('provision-email-error')).toBeTruthy();
  });

  it('switches to saga stepper view on successful submit', async () => {
    server.use(
      http.get(
        '*/api/v1/admin/super/tenants/:id/provision-status',
        () =>
          HttpResponse.json({
            data: { step: 2, status: 'running', failedAt: null, error: null },
          }),
      ),
    );

    await renderPage();
    fireEvent.change(screen.getByTestId('provision-name-input'), {
      target: { value: 'Igreja Restauração' },
    });
    fireEvent.change(screen.getByTestId('provision-email-input'), {
      target: { value: 'admin@restauracao.org' },
    });
    fireEvent.change(screen.getByTestId('provision-slug-input'), {
      target: { value: 'igreja-nova-restauracao' },
    });
    fireEvent.click(screen.getByTestId('provision-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('provision-saga-stepper')).toBeTruthy(),
    );
    expect(screen.getByTestId('provision-saga-step-1')).toBeTruthy();
    expect(screen.getByTestId('provision-saga-step-2')).toBeTruthy();
    expect(screen.getByTestId('provision-saga-step-3')).toBeTruthy();
  });

  it('shows slug conflict error from server (409)', async () => {
    await renderPage();
    fireEvent.change(screen.getByTestId('provision-name-input'), {
      target: { value: 'Igreja Caminho Novo' },
    });
    fireEvent.change(screen.getByTestId('provision-email-input'), {
      target: { value: 'admin@caminhonovo.org' },
    });
    // Slug "igreja-caminho-novo" already exists in MSW fixture
    fireEvent.click(screen.getByTestId('provision-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('provision-slug-conflict')).toBeTruthy(),
    );
  });
});
