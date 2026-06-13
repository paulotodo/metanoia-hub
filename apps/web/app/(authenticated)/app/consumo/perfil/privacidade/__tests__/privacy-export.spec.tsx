import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import PrivacidadeConsentimentoPage from '../page';
import { resetPrivacyMockState } from '@test-mocks/handlers/privacy';

const MOCK_JOB_ID = '0199a000-0000-7000-8000-000000000001';
const MOCK_SIGNED_URL =
  'https://minio.example.com/exports/global/0199a000-data.json?X-Amz-Expires=172800';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(PrivacidadeConsentimentoPage),
    ),
  );
}

beforeEach(() => {
  resetPrivacyMockState();
});

describe('PrivacidadeConsentimentoPage — export section', () => {
  it('renders the export button (AC6)', () => {
    renderPage();
    const btn = screen.getByTestId('export-button');
    expect(btn).toBeDefined();
    expect(btn.textContent).toContain('Exportar meus dados');
  });

  it('shows export button enabled initially', () => {
    renderPage();
    const btn = screen.getByTestId('export-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('disables button while export is in progress (AC6)', async () => {
    renderPage();
    const btn = screen.getByTestId('export-button') as HTMLButtonElement;

    fireEvent.click(btn);

    await waitFor(() => {
      expect(btn.disabled).toBe(true);
    });
  });

  it('shows completed status with download link when status = completed (AC7)', async () => {
    // Override to go straight to completed
    server.use(
      http.post('*/api/v1/privacy/export', () => {
        return HttpResponse.json(
          {
            data: {
              jobId: MOCK_JOB_ID,
              status: 'accepted',
              estimatedCompletionHours: 24,
            },
          },
          { status: 202 },
        );
      }),
      http.get('*/api/v1/privacy/export/:jobId', () => {
        return HttpResponse.json({
          data: {
            jobId: MOCK_JOB_ID,
            status: 'completed',
            signedUrl: MOCK_SIGNED_URL,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            failureReason: null,
          },
        });
      }),
    );

    renderPage();
    const btn = screen.getByTestId('export-button');
    fireEvent.click(btn);

    await waitFor(
      () => {
        expect(screen.queryByTestId('export-completed')).not.toBeNull();
      },
      { timeout: 10_000 },
    );

    const downloadLink = screen.getByTestId('download-link') as HTMLAnchorElement;
    expect(downloadLink.href).toBe(MOCK_SIGNED_URL);
    expect(downloadLink.target).toBe('_blank');
  });

  it('shows duplicate warning on 409 response', async () => {
    server.use(
      http.post('*/api/v1/privacy/export', () => {
        return HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'Export already in progress' },
          { status: 409 },
        );
      }),
    );

    renderPage();
    const btn = screen.getByTestId('export-button');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.queryByTestId('duplicate-warning')).not.toBeNull();
    });
  });
});
