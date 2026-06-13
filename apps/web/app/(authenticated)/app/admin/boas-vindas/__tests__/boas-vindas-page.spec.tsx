/**
 * Integration test: BoasVindasPage renders OnboardingWizard with wizard status.
 * Tests 5.3 (tasks.md FASE 5).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ONBOARDING_PROGRESS_DEFAULT } from '@metanoia/types';

// Mock next/headers (server-only, not available in test env)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'mock-token' }),
  }),
}));

// Mock OnboardingWizard to avoid full component tree in page tests
vi.mock('@/components/onboarding', () => ({
  OnboardingWizard: vi.fn(({ hasRealGroups, readOnly }: {
    initialProgress?: unknown;
    hasRealGroups: boolean;
    readOnly?: boolean;
  }) => (
    <div data-testid="onboarding-wizard"
      data-readonly={String(readOnly ?? false)}
      data-has-real-groups={String(hasRealGroups)}
    />
  )),
}));

// Mock global fetch used by the Server Component
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { default: BoasVindasPage } = await import('../page');

const MOCK_STATUS_RESPONSE = {
  data: {
    progress: { ...ONBOARDING_PROGRESS_DEFAULT },
    hasRealGroups: false,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BoasVindasPage', () => {
  it('renders OnboardingWizard when API returns status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_STATUS_RESPONSE),
    });

    const Page = await BoasVindasPage();
    const { getByTestId } = render(Page);
    expect(getByTestId('onboarding-wizard')).toBeTruthy();
  });

  it('renders OnboardingWizard with default progress when API fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    const Page = await BoasVindasPage();
    const { getByTestId } = render(Page);
    const wizard = getByTestId('onboarding-wizard');
    expect(wizard).toBeTruthy();
    // Default: hasRealGroups = false
    expect(wizard.getAttribute('data-has-real-groups')).toBe('false');
  });

  it('renders without readOnly prop (not replay mode)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_STATUS_RESPONSE),
    });

    const Page = await BoasVindasPage();
    const { getByTestId } = render(Page);
    // readOnly should be false (default) for the main boas-vindas page
    expect(getByTestId('onboarding-wizard').getAttribute('data-readonly')).toBe('false');
  });
});
