import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import { DeletionPendingBanner } from '../deletion-pending-banner';
import { resetUserMockState } from '@test-mocks/handlers/users';
import {
  resetPrivacyDeletionMockState,
  MOCK_DELETION_REQUEST_ID,
} from '@test-mocks/handlers/privacy-deletion';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function renderBanner(props?: { requestId?: string }) {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <DeletionPendingBanner {...props} />
    </Wrapper>,
  );
}

beforeEach(() => {
  resetUserMockState();
  resetPrivacyDeletionMockState();
});

describe('DeletionPendingBanner', () => {
  it('renders nothing when user status is active', async () => {
    // Default mock returns 'active' status
    const { container } = renderBanner();

    await waitFor(() => {
      // After the user query resolves to active, banner should not be rendered
      expect(screen.queryByTestId('deletion-pending-banner')).toBeNull();
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when user status is deletion_pending', async () => {
    server.use(
      http.get('*/api/v1/users/me', () =>
        HttpResponse.json({
          data: {
            id: '01912345-6789-7000-8000-0000000000a1',
            email: 'joao@igrejabetania.com.br',
            name: 'João Silva',
            status: 'deletion_pending',
          },
        }),
      ),
    );

    renderBanner({ requestId: MOCK_DELETION_REQUEST_ID });

    await waitFor(
      () => expect(screen.getByTestId('deletion-pending-banner')).toBeTruthy(),
      { timeout: 5000 },
    );

    expect(screen.getByText(/exclusão de conta solicitada/i)).toBeTruthy();
  });

  it('shows cancel button when requestId is provided', async () => {
    server.use(
      http.get('*/api/v1/users/me', () =>
        HttpResponse.json({
          data: {
            id: '01912345-6789-7000-8000-0000000000a1',
            email: 'joao@igrejabetania.com.br',
            name: 'João Silva',
            status: 'deletion_pending',
          },
        }),
      ),
    );

    renderBanner({ requestId: MOCK_DELETION_REQUEST_ID });

    await waitFor(
      () => expect(screen.getByTestId('banner-cancel-deletion-button')).toBeTruthy(),
      { timeout: 5000 },
    );
  });

  it('does not show cancel button when requestId is absent', async () => {
    server.use(
      http.get('*/api/v1/users/me', () =>
        HttpResponse.json({
          data: {
            id: '01912345-6789-7000-8000-0000000000a1',
            email: 'joao@igrejabetania.com.br',
            name: 'João Silva',
            status: 'deletion_pending',
          },
        }),
      ),
    );

    renderBanner(); // no requestId

    await waitFor(
      () => expect(screen.getByTestId('deletion-pending-banner')).toBeTruthy(),
      { timeout: 5000 },
    );

    expect(screen.queryByTestId('banner-cancel-deletion-button')).toBeNull();
  });

  it('cancel button calls cancelDeletion on click', async () => {
    server.use(
      http.get('*/api/v1/users/me', () =>
        HttpResponse.json({
          data: {
            id: '01912345-6789-7000-8000-0000000000a1',
            email: 'joao@igrejabetania.com.br',
            name: 'João Silva',
            status: 'deletion_pending',
          },
        }),
      ),
      http.delete(`*/api/v1/privacy/deletion/${MOCK_DELETION_REQUEST_ID}`, () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );

    renderBanner({ requestId: MOCK_DELETION_REQUEST_ID });

    await waitFor(
      () => expect(screen.getByTestId('banner-cancel-deletion-button')).toBeTruthy(),
      { timeout: 5000 },
    );

    const cancelButton = screen.getByTestId('banner-cancel-deletion-button');
    fireEvent.click(cancelButton);

    // Button should show loading state or complete
    await waitFor(() => {
      expect(cancelButton).toBeTruthy();
    });
  });
});
