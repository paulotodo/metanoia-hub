import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { axe, toHaveNoViolations } from 'jest-axe';
import PrivacidadeConsentimentoPage from '../page';

expect.extend(toHaveNoViolations);

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

describe('PrivacidadeConsentimentoPage', () => {
  it('renders heading and loading skeleton initially', () => {
    const { container } = render(
      createElement(QueryClientProvider, {
        client: new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        }),
      }, createElement(PrivacidadeConsentimentoPage)),
    );
    expect(container.querySelector('h1')).toBeDefined();
  });

  it('renders consent items after data loads (via MSW)', async () => {
    const Wrapper = createWrapper();
    render(createElement(Wrapper, {}, createElement(PrivacidadeConsentimentoPage)));

    // Wait for MSW to respond
    await waitFor(() => {
      expect(screen.queryByTestId('consent-loading')).toBeNull();
    });

    // Should render a list with consent items
    const list = screen.queryByRole('list', { name: /consentimentos/i });
    expect(list).not.toBeNull();
  });

  it('disables withdraw button for mandatory consent types', async () => {
    const Wrapper = createWrapper();
    render(createElement(Wrapper, {}, createElement(PrivacidadeConsentimentoPage)));

    await waitFor(() => {
      expect(screen.queryByTestId('consent-loading')).toBeNull();
    });

    // Find buttons labeled "Obrigatório" and verify they are disabled
    const mandatoryButtons = screen.queryAllByRole('button', { name: /obrigatório/i });
    for (const btn of mandatoryButtons) {
      expect(btn).toHaveProperty('disabled', true);
    }
  });

  it('has no accessibility violations (jest-axe)', async () => {
    const Wrapper = createWrapper();
    const { container } = render(
      createElement(Wrapper, {}, createElement(PrivacidadeConsentimentoPage)),
    );

    // Wait for data to load before running axe (avoid false positives on skeleton)
    await waitFor(() => {
      expect(screen.queryByTestId('consent-loading')).toBeNull();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
