/**
 * Accessibility tests for BrandingSettingsForm (Story 11-2 — AC8).
 *
 * Uses jest-axe to catch WCAG violations.
 * Lição 11-1: never use role="article" on <a> elements.
 * All <input> elements must have associated <label> via htmlFor + id.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandingSettingsForm } from './BrandingSettingsForm';
import type { BrandingResponse } from '@metanoia/types';

const PRO_BRANDING: BrandingResponse = {
  primaryColor: '#1E40AF',
  secondaryColor: '#F59E0B',
  displayName: 'Igreja Teste',
  logoUrl: null,
  plan: 'pro',
  canCustomizeBranding: true,
};

const FREE_BRANDING: BrandingResponse = {
  primaryColor: null,
  secondaryColor: null,
  displayName: 'Igreja Livre',
  logoUrl: null,
  plan: 'free',
  canCustomizeBranding: false,
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('BrandingSettingsForm — accessibility (jest-axe)', () => {
  it('Pro tenant: no a11y violations (AC8)', async () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Free tenant (disabled fields): no a11y violations', async () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={FREE_BRANDING} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('null initial branding: renders without violations', async () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={null} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('all text inputs have associated labels (htmlFor+id)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );

    const inputs = container.querySelectorAll('input[type="text"]');
    inputs.forEach((input) => {
      const id = input.getAttribute('id');
      expect(id).toBeTruthy();
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label).not.toBeNull();
      }
    });
  });

  it('file input has aria-label', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    if (fileInput) {
      expect(
        fileInput.getAttribute('aria-label') ?? fileInput.getAttribute('id'),
      ).toBeTruthy();
    }
  });

  it('no <a> elements with role="article" (lição 11-1)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const links = container.querySelectorAll('a[role="article"]');
    expect(links.length).toBe(0);
  });
});
