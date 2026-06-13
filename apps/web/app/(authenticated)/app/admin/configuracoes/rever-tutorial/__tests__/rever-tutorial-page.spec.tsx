/**
 * Integration test: ReverTutorialPage renders OnboardingWizard in readOnly mode.
 * Tests 5.3 (tasks.md FASE 5) — dec-010, FR-09.
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

const { default: ReverTutorialPage } = await import('../page');

const MOCK_STATUS_RESPONSE = {
  data: {
    progress: { ...ONBOARDING_PROGRESS_DEFAULT, completed: true, completedAt: '2026-01-01T00:00:00.000Z' },
    hasRealGroups: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReverTutorialPage', () => {
  it('renders OnboardingWizard with readOnly=true (replay mode)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_STATUS_RESPONSE),
    });

    const Page = await ReverTutorialPage();
    const { getByTestId } = render(Page);
    const wizard = getByTestId('onboarding-wizard');
    // MUST be readOnly — dec-010, FR-09: progress not modified in replay
    expect(wizard.getAttribute('data-readonly')).toBe('true');
  });

  it('renders with default progress when API fails, still readOnly=true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    const Page = await ReverTutorialPage();
    const { getByTestId } = render(Page);
    const wizard = getByTestId('onboarding-wizard');
    expect(wizard.getAttribute('data-readonly')).toBe('true');
  });

  it('does not allow editing (readOnly enforced)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_STATUS_RESPONSE),
    });

    const Page = await ReverTutorialPage();
    const { getByTestId } = render(Page);
    // readOnly=true means no form submissions — guard at component level
    expect(getByTestId('onboarding-wizard').getAttribute('data-readonly')).toBe('true');
  });
});
