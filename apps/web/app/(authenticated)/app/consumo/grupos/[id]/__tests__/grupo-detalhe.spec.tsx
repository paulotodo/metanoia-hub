import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { server } from '../../../../../../../mocks/server';

const replace = vi.fn();
let mockId = '019756c0-2000-7000-8000-000000000001';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: mockId }),
  useSearchParams: () => new URLSearchParams(''),
}));

import ParticipantGroupDetailPage from '../page';

async function renderPage(id = '019756c0-2000-7000-8000-000000000001') {
  mockId = id;
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Wrapper>
        <ParticipantGroupDetailPage />
      </Wrapper>,
    );
  });
  return result;
}

describe('ParticipantGroupDetailPage — full fixture', () => {
  it('renders leader, name, description, meeting and format', async () => {
    await renderPage('019756c0-2000-7000-8000-000000000001');
    await waitFor(() =>
      expect(screen.getByText('Fundamentos da Fé')).toBeTruthy(),
    );
    expect(screen.getByText('Marcos lidera esse grupo')).toBeTruthy();
    expect(screen.getByTestId('mygroup-description')).toBeTruthy();
    expect(screen.getByTestId('mygroup-meeting-date')).toBeTruthy();
    expect(screen.getByTestId('mygroup-meeting-relative')).toBeTruthy();
    expect(screen.getByTestId('mygroup-meeting-location')).toBeTruthy();
    expect(screen.getByTestId('mygroup-format')).toBeTruthy();
    expect(
      screen.getByText('Sem pressa. Quando você vier, a gente tá aqui.'),
    ).toBeTruthy();
  });

  it('does not render peers section nor a "entrar na reunião" button', async () => {
    await renderPage('019756c0-2000-7000-8000-000000000001');
    await waitFor(() =>
      expect(screen.getByText('Fundamentos da Fé')).toBeTruthy(),
    );
    expect(screen.queryByText(/outros participantes/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /entrar na reunião/i })).toBeNull();
  });
});

describe('ParticipantGroupDetailPage — minimal fixture', () => {
  it('omits description, meeting details and format when fields are null', async () => {
    await renderPage('019756c0-2000-7000-8000-000000000002');
    await waitFor(() =>
      expect(screen.getByText('Caminhada em Cristo')).toBeTruthy(),
    );
    expect(screen.queryByTestId('mygroup-description')).toBeNull();
    expect(screen.getByTestId('mygroup-meeting-empty')).toBeTruthy();
    expect(screen.queryByTestId('mygroup-format')).toBeNull();
    expect(
      screen.getByText('Sem pressa. Quando você vier, a gente tá aqui.'),
    ).toBeTruthy();
  });
});

describe('ParticipantGroupDetailPage — 404 handling', () => {
  it('redirects to the list with notFound flag on 404', async () => {
    replace.mockClear();
    server.use(
      http.get('*/api/v1/participant/groups/:id', () =>
        HttpResponse.json(
          { statusCode: 404, error: 'NotFound', message: 'not found' },
          { status: 404 },
        ),
      ),
    );
    await renderPage('019756c0-2000-7000-8000-00000000dead');
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/app/consumo/grupos?notFound=1'),
    );
  });
});
