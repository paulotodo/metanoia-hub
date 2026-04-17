import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

import SelecionarIgrejaPage from '../page';

async function renderPage() {
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Wrapper>
        <SelecionarIgrejaPage />
      </Wrapper>,
    );
  });
  return result;
}

describe('SelecionarIgrejaPage', () => {
  it('renders page heading and subtitle', async () => {
    await renderPage();
    expect(
      screen.getByRole('heading', {
        name: 'Escolha a igreja que você quer servir agora',
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Você faz parte de mais de uma comunidade. Escolha por qual quer entrar.',
      ),
    ).toBeDefined();
  });

  it('loads the list of tenants from MSW handler', async () => {
    await renderPage();
    expect(await screen.findByText('Igreja Batista Central')).toBeDefined();
    expect(screen.getByText('Comunidade Graça')).toBeDefined();
    expect(screen.getByText('Igreja da Vila')).toBeDefined();
  });

  it('navigates to /app/gestao after selecting a tenant', async () => {
    push.mockClear();
    await renderPage();
    await screen.findByText('Igreja Batista Central');
    fireEvent.click(
      screen.getByRole('button', {
        name: /Entrar em Igreja Batista Central/,
      }),
    );
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/app/gestao');
    });
  });
});
