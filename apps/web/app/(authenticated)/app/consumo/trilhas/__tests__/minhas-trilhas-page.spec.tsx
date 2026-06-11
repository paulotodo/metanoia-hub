/**
 * minhas-trilhas-page.spec.tsx
 * Tests for /app/consumo/trilhas page (Minhas Trilhas — Story 8-10).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import MinhasTrilhasPage from '../page';
import type { MyTrailsResponse } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock IntersectionObserver
beforeEach(() => {
  class MockIO {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(cb: IntersectionObserverCallback) {
      // no-op
      void cb;
    }
  }
  vi.stubGlobal('IntersectionObserver', MockIO);
});

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockResponse: MyTrailsResponse = {
  data: [
    {
      id: '018e6b1c-0000-7000-8000-000000000101',
      name: 'Discipulado Básico',
      description: 'Fundamentos da fé cristã.',
      moduleCount: 3,
      lessonCount: 12,
      progressPercent: 50,
      status: 'in_progress',
      lastActivity: '2026-06-10T14:30:00.000Z',
    },
  ],
  meta: { nextCursor: null, total: 1 },
};

const emptyResponse: MyTrailsResponse = {
  data: [],
  meta: { nextCursor: null, total: 0 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MinhasTrilhasPage', () => {
  it('renders page title', async () => {
    server.use(
      http.get('*/api/v1/my-trails', () => HttpResponse.json(mockResponse)),
    );
    render(
      <Wrapper>
        <MinhasTrilhasPage />
      </Wrapper>,
    );
    expect(screen.getByText('Minhas Trilhas')).toBeTruthy();
  });

  it('shows skeleton while loading', () => {
    server.use(
      http.get('*/api/v1/my-trails', async () => {
        await new Promise((r) => setTimeout(r, 500));
        return HttpResponse.json(mockResponse);
      }),
    );
    render(
      <Wrapper>
        <MinhasTrilhasPage />
      </Wrapper>,
    );
    // Skeleton list should appear during loading
    const busyEls = document.querySelectorAll('[aria-busy="true"]');
    expect(busyEls.length).toBeGreaterThan(0);
  });

  it('renders trail cards after loading', async () => {
    server.use(
      http.get('*/api/v1/my-trails', () => HttpResponse.json(mockResponse)),
    );
    render(
      <Wrapper>
        <MinhasTrilhasPage />
      </Wrapper>,
    );
    await screen.findByText('Discipulado Básico');
    expect(screen.getByText('Discipulado Básico')).toBeTruthy();
  });

  it('shows empty state when no trails', async () => {
    server.use(
      http.get('*/api/v1/my-trails', () => HttpResponse.json(emptyResponse)),
    );
    render(
      <Wrapper>
        <MinhasTrilhasPage />
      </Wrapper>,
    );
    await screen.findByText('Nenhuma trilha disponível ainda.');
    expect(
      screen.getByText(
        'Fale com o líder do seu grupo para começar sua jornada de discipulado.',
      ),
    ).toBeTruthy();
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get('*/api/v1/my-trails', () =>
        HttpResponse.json({ statusCode: 500, error: 'Server Error', message: 'fail' }, { status: 500 }),
      ),
    );
    render(
      <Wrapper>
        <MinhasTrilhasPage />
      </Wrapper>,
    );
    await screen.findByRole('alert');
    expect(screen.getByText(/Não foi possível carregar suas trilhas/)).toBeTruthy();
  });

  it('passes jest-axe in loaded state', async () => {
    server.use(
      http.get('*/api/v1/my-trails', () => HttpResponse.json(mockResponse)),
    );
    const { container } = render(
      <Wrapper>
        <MinhasTrilhasPage />
      </Wrapper>,
    );
    await screen.findByText('Discipulado Básico');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('passes jest-axe in empty state', async () => {
    server.use(
      http.get('*/api/v1/my-trails', () => HttpResponse.json(emptyResponse)),
    );
    const { container } = render(
      <Wrapper>
        <MinhasTrilhasPage />
      </Wrapper>,
    );
    await screen.findByText('Nenhuma trilha disponível ainda.');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows "all loaded" message when no next page', async () => {
    server.use(
      http.get('*/api/v1/my-trails', () => HttpResponse.json(mockResponse)),
    );
    render(
      <Wrapper>
        <MinhasTrilhasPage />
      </Wrapper>,
    );
    await screen.findByText('Discipulado Básico');
    await waitFor(() => {
      expect(screen.getByText('Você viu todas as suas trilhas.')).toBeTruthy();
    });
  });
});
