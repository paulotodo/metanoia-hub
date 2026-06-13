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

vi.mock('@/lib/api/hooks/use-onboarding', () => ({
  useWizardStatus: vi.fn(),
}));

vi.mock('@/lib/session/use-current-role', () => ({
  useCurrentRole: vi.fn(),
}));

// Lazy imports so mocks are applied first
const { OnboardingRedirectGuard } = await import('../onboarding-redirect-guard');
const { useOnboardingStatus } = await import('@/lib/api/hooks/use-users');
const { useWizardStatus } = await import('@/lib/api/hooks/use-onboarding');
const { useCurrentRole } = await import('@/lib/session/use-current-role');
const { usePathname } = await import('next/navigation');

const Wrapper = createQueryClientWrapper();

// Default wizard status (tenant onboarding not started)
// Shape mirrors OnboardingStatusResponseSchema: { data: { progress, hasRealGroups } }
const DEFAULT_WIZARD_STATUS = {
  data: {
    progress: {
      currentStep: 1,
      completedSteps: [],
      stepData: {},
      completed: false,
      completedAt: null,
      skippedAt: null,
    },
    hasRealGroups: false,
  },
};

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
  // Default: both hooks return loading state
  vi.mocked(useOnboardingStatus).mockReturnValue({
    data: undefined,
    isSuccess: false,
  } as never);
  vi.mocked(useWizardStatus).mockReturnValue({
    data: undefined,
    isSuccess: false,
  } as never);
});

// ---------------------------------------------------------------------------
// Legacy user-scoped behaviour (lider / participante — Story 7-1)
// ---------------------------------------------------------------------------

describe('OnboardingRedirectGuard — legacy user-scoped (lider/participante)', () => {
  it('renders children without redirect when onboarding complete (lider)', async () => {
    vi.mocked(useOnboardingStatus).mockReturnValue({
      data: { onboardingCompletedAt: '2026-01-01T00:00:00.000Z' },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('lider');

    const { getByTestId } = renderGuard();
    await waitFor(() => expect(getByTestId('child')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
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
});

// ---------------------------------------------------------------------------
// admin_tenant — TRIPLE condition (FR-01)
// ---------------------------------------------------------------------------

describe('OnboardingRedirectGuard — admin_tenant triple condition (FR-01)', () => {
  it('redirects admin_tenant when triple condition is all true (first login)', async () => {
    vi.mocked(useWizardStatus).mockReturnValue({
      data: DEFAULT_WIZARD_STATUS,
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/app/admin/boas-vindas'),
    );
  });

  it('does NOT redirect admin_tenant when progress.completed=true', async () => {
    vi.mocked(useWizardStatus).mockReturnValue({
      data: {
        data: {
          progress: { ...DEFAULT_WIZARD_STATUS.data.progress, completed: true, completedAt: '2026-01-01T00:00:00.000Z' },
          hasRealGroups: false,
        },
      },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does NOT redirect admin_tenant when skippedAt is set', async () => {
    vi.mocked(useWizardStatus).mockReturnValue({
      data: {
        data: {
          progress: { ...DEFAULT_WIZARD_STATUS.data.progress, skippedAt: '2026-01-01T00:00:00.000Z' },
          hasRealGroups: false,
        },
      },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does NOT redirect admin_tenant when hasRealGroups=true', async () => {
    vi.mocked(useWizardStatus).mockReturnValue({
      data: {
        data: {
          progress: DEFAULT_WIZARD_STATUS.data.progress,
          hasRealGroups: true,
        },
      },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does NOT redirect while wizard status is loading', async () => {
    vi.mocked(useWizardStatus).mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// super_admin — never redirected
// ---------------------------------------------------------------------------

describe('OnboardingRedirectGuard — super_admin never redirected', () => {
  it('does NOT redirect super_admin even with incomplete wizard', async () => {
    vi.mocked(useWizardStatus).mockReturnValue({
      data: DEFAULT_WIZARD_STATUS,
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('super_admin');

    renderGuard();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Loop prevention
// ---------------------------------------------------------------------------

describe('OnboardingRedirectGuard — loop prevention', () => {
  it('does not redirect if already on /app/admin/boas-vindas', async () => {
    vi.mocked(usePathname).mockReturnValue('/app/admin/boas-vindas');
    vi.mocked(useWizardStatus).mockReturnValue({
      data: DEFAULT_WIZARD_STATUS,
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    renderGuard();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect if already on /app/gestao/boas-vindas', async () => {
    vi.mocked(usePathname).mockReturnValue('/app/gestao/boas-vindas');
    vi.mocked(useOnboardingStatus).mockReturnValue({
      data: { onboardingCompletedAt: null },
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('lider');

    renderGuard();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Render children
// ---------------------------------------------------------------------------

describe('OnboardingRedirectGuard — renders children unconditionally', () => {
  it('always renders children during loading', () => {
    vi.mocked(useCurrentRole).mockReturnValue(null);

    const { getByTestId } = renderGuard();
    expect(getByTestId('child')).toBeTruthy();
  });

  it('renders children even when redirect is pending', async () => {
    vi.mocked(useWizardStatus).mockReturnValue({
      data: DEFAULT_WIZARD_STATUS,
      isSuccess: true,
    } as never);
    vi.mocked(useCurrentRole).mockReturnValue('admin_tenant');

    const { getByTestId } = renderGuard();
    expect(getByTestId('child')).toBeTruthy();
  });
});
