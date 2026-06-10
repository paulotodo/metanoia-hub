import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';

// --- mocks ---

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/app/gestao/radar'),
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/lib/api/hooks/use-users', () => ({
  useOnboardingStatus: vi.fn(),
}));

vi.mock('@/lib/session/use-current-role', () => ({
  useCurrentRole: vi.fn(),
}));

// Lazy imports so mocks are applied first
const { OnboardingRedirectGuard } = await import('../onboarding-redirect-guard');
const { useOnboardingStatus } = await import('@/lib/api/hooks/use-users');
const { useCurrentRole } = await import('@/lib/session/use-current-role');
const { usePathname } = await import('next/navigation');

const Wrapper = createQueryClientWrapper();

function renderGuard() {
  return render(
    <Wrapper>
      <OnboardingRedirectGuard>
        <div data-testid="child">content</div>
      </OnboardingRedirectGuard>
    </Wrapper>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OnboardingRedirectGuard', () => {
  it('renders children without redirect when onboarding complete', async () => {
    vi.mocked(useOnboardingStatus).mockReturnValue({
      data: { onboardingCompletedAt: '2026-01-01T00:00:00.000Z' },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    const { getByTestId } = renderGuard();
    await waitFor(() => expect(getByTestId('child')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects admin_tenant to admin welcome when onboarding null', async () => {
    vi.mocked(useOnboardingStatus).mockReturnValue({
      data: { onboardingCompletedAt: null },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/app/admin/boas-vindas'),
    );
  });

  it('redirects lider to gestao welcome when onboarding null', async () => {
    vi.mocked(useOnboardingStatus).mockReturnValue({
      data: { onboardingCompletedAt: null },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('lider');

    renderGuard();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/app/gestao/boas-vindas'),
    );
  });

  it('redirects participante to consumo welcome when onboarding null', async () => {
    vi.mocked(useOnboardingStatus).mockReturnValue({
      data: { onboardingCompletedAt: null },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('participante');

    renderGuard();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/app/consumo/boas-vindas'),
    );
  });

  it('does not redirect if already on a welcome path', async () => {
    vi.mocked(usePathname).mockReturnValue('/app/admin/boas-vindas');
    vi.mocked(useOnboardingStatus).mockReturnValue({
      data: { onboardingCompletedAt: null },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    // Small delay to allow the effect to run
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect while status is loading', async () => {
    vi.mocked(useOnboardingStatus).mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
