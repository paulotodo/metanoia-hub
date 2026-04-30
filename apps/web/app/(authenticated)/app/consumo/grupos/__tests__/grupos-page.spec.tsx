import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { server } from '../../../../../../mocks/server';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

import ParticipantGroupsPage from '../page';

async function renderPage() {
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Wrapper>
        <ParticipantGroupsPage />
      </Wrapper>,
    );
  });
  return result;
}

describe('ParticipantGroupsPage', () => {
  it('renders cards from MSW fixture', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText('Fundamentos da Fé')).toBeTruthy(),
    );
    expect(screen.getByText('Caminhada em Cristo')).toBeTruthy();
    expect(screen.getByRole('list')).toBeTruthy();
  });

  it('shows welcome banner when firstVisit=true (default fixture)', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('mygroups-welcome')).toBeTruthy(),
    );
  });

  it('hides welcome banner when fixture returns firstVisit=false', async () => {
    server.use(
      http.get('*/api/v1/participant/groups', () =>
        HttpResponse.json({
          data: [
            {
              id: '019756c0-2000-7000-8000-000000000001',
              name: 'Fundamentos da Fé',
              leader: { firstName: 'Marcos', avatarUrl: null },
              nextMeeting: null,
            },
          ],
          meta: { firstVisit: false },
        }),
      ),
    );
    await renderPage();
    await waitFor(() => expect(screen.getByText('Meus Grupos')).toBeTruthy());
    expect(screen.queryByTestId('mygroups-welcome')).toBeNull();
  });

  it('renders empty state when the list is empty', async () => {
    server.use(
      http.get('*/api/v1/participant/groups', () =>
        HttpResponse.json({ data: [], meta: { firstVisit: true } }),
      ),
    );
    await renderPage();
    await waitFor(() => expect(screen.getByTestId('mygroups-empty')).toBeTruthy());
  });

  it('renders error state and retry button on network failure', async () => {
    server.use(
      http.get('*/api/v1/participant/groups', () =>
        HttpResponse.json(
          { statusCode: 500, error: 'ServerError', message: 'boom' },
          { status: 500 },
        ),
      ),
    );
    await renderPage();
    await waitFor(() => expect(screen.getByTestId('mygroups-error')).toBeTruthy());
    const retry = screen.getByRole('button', { name: 'Tentar novamente' });
    fireEvent.click(retry);
  });
});
