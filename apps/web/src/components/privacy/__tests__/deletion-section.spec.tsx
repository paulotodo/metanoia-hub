import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import { DeletionSection } from '../deletion-section';
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

function renderSection(props?: { initialRequestId?: string }) {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <DeletionSection {...props} />
    </Wrapper>,
  );
}

beforeEach(() => {
  resetPrivacyDeletionMockState();
});

describe('DeletionSection', () => {
  it('renders the section title', () => {
    renderSection();
    expect(screen.getByText(/solicitar exclusão da conta/i)).toBeTruthy();
  });

  it('shows confirmation checkbox and disabled button initially', () => {
    renderSection();
    const checkbox = screen.getByTestId('deletion-confirm-checkbox');
    const button = screen.getByTestId('request-deletion-button');
    expect(checkbox).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables the request button after checking the confirmation', () => {
    renderSection();
    const checkbox = screen.getByTestId('deletion-confirm-checkbox');
    fireEvent.click(checkbox);
    const button = screen.getByTestId('request-deletion-button');
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows pending status after successful deletion request', async () => {
    renderSection();

    fireEvent.click(screen.getByTestId('deletion-confirm-checkbox'));
    fireEvent.click(screen.getByTestId('request-deletion-button'));

    await waitFor(() =>
      expect(screen.getByTestId('deletion-pending-status')).toBeTruthy(),
    );

    expect(screen.getByText(/exclusão solicitada/i)).toBeTruthy();
    expect(screen.getByTestId('cancel-deletion-button')).toBeTruthy();
  });

  it('shows duplicate warning on 409', async () => {
    server.use(
      http.post('*/api/v1/privacy/deletion', () =>
        HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'Deletion request already active' },
          { status: 409 },
        ),
      ),
    );

    renderSection();

    fireEvent.click(screen.getByTestId('deletion-confirm-checkbox'));
    fireEvent.click(screen.getByTestId('request-deletion-button'));

    await waitFor(() =>
      expect(screen.getByTestId('deletion-duplicate-warning')).toBeTruthy(),
    );
  });

  it('shows leader blocker warning on 422', async () => {
    server.use(
      http.post('*/api/v1/privacy/deletion', () =>
        HttpResponse.json(
          { statusCode: 422, error: 'LEADER_ACTIVE_GROUPS', message: 'Leader has active groups' },
          { status: 422 },
        ),
      ),
    );

    renderSection();

    fireEvent.click(screen.getByTestId('deletion-confirm-checkbox'));
    fireEvent.click(screen.getByTestId('request-deletion-button'));

    await waitFor(() =>
      expect(screen.getByTestId('deletion-leader-blocker')).toBeTruthy(),
    );
  });

  it('shows pending status and cancel button when initialRequestId provided', () => {
    // Simulate an already-active deletion request
    server.use(
      http.get(`*/api/v1/privacy/deletion/${MOCK_DELETION_REQUEST_ID}`, () =>
        HttpResponse.json({
          data: {
            requestId: MOCK_DELETION_REQUEST_ID,
            status: 'pending',
            cancellableUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            deletionDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            cancelledAt: null,
            completedAt: null,
            failureReason: null,
          },
        }),
      ),
    );

    renderSection({ initialRequestId: MOCK_DELETION_REQUEST_ID });

    // With initialRequestId, the pending status block should show
    expect(screen.getByTestId('deletion-pending-status')).toBeTruthy();
    expect(screen.getByTestId('cancel-deletion-button')).toBeTruthy();
  });
});
