import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { OnboardingWizard } from '../OnboardingWizard';
import type { OnboardingProgress } from '@metanoia/types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/app/admin/boas-vindas',
}));

const DEFAULT_PROGRESS: OnboardingProgress = {
  currentStep: 1,
  completedSteps: [],
  stepData: {},
  completed: false,
  completedAt: null,
  skippedAt: null,
};

const Wrapper = createQueryClientWrapper();

function renderWizard(progress = DEFAULT_PROGRESS, readOnly = false) {
  return render(
    <Wrapper>
      <OnboardingWizard
        initialProgress={progress}
        hasRealGroups={false}
        readOnly={readOnly}
      />
    </Wrapper>,
  );
}

describe('OnboardingWizard', () => {
  it('renders the wizard dialog', () => {
    renderWizard();
    expect(screen.getByTestId('onboarding-wizard')).toBeTruthy();
  });

  it('renders step 1 by default', () => {
    renderWizard();
    // Step 1 fields should be present
    expect(screen.getByTestId('step1-name')).toBeTruthy();
  });

  it('renders correct step from initialProgress.currentStep', () => {
    renderWizard({ ...DEFAULT_PROGRESS, currentStep: 2, completedSteps: [1] });
    expect(screen.getByTestId('step2-community-name')).toBeTruthy();
  });

  it('shows skip button when not readOnly', () => {
    renderWizard();
    expect(screen.getByTestId('wizard-skip')).toBeTruthy();
  });

  it('does not show skip button in readOnly mode', () => {
    renderWizard(DEFAULT_PROGRESS, true);
    expect(screen.queryByTestId('wizard-skip')).toBeNull();
  });

  it('shows read-only banner in readOnly mode', () => {
    const { container } = renderWizard(DEFAULT_PROGRESS, true);
    expect(container.textContent).toContain('Modo visualização');
  });

  it('shows back button when on step > 1', () => {
    renderWizard({ ...DEFAULT_PROGRESS, currentStep: 2, completedSteps: [1] });
    expect(screen.getByTestId('wizard-back')).toBeTruthy();
  });

  it('progress bar reflects completed steps', () => {
    const { container } = renderWizard({
      ...DEFAULT_PROGRESS,
      currentStep: 3,
      completedSteps: [1, 2],
    });
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toBeTruthy();
    // 2 of 5 = 40%
    expect((progressBar as HTMLElement).style.width).toBe('40%');
  });

  it('step 4 auto-skips when mode is demo', () => {
    renderWizard({
      ...DEFAULT_PROGRESS,
      currentStep: 4,
      completedSteps: [1, 2, 3],
      stepData: { mode: 'demo' },
    });
    // Step 4 should not render in demo mode — step 5 is shown instead
    expect(screen.queryByTestId('step4-invite-submit')).toBeNull();
    expect(screen.queryByTestId('step4-skip')).toBeNull();
  });

  it('WCAG AA — no accessibility violations on step 1', async () => {
    const { container } = renderWizard();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('WCAG AA — no accessibility violations in readOnly mode', async () => {
    const { container } = renderWizard(DEFAULT_PROGRESS, true);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('back button navigates to previous step', () => {
    renderWizard({ ...DEFAULT_PROGRESS, currentStep: 2, completedSteps: [1] });
    const backBtn = screen.getByTestId('wizard-back');
    fireEvent.click(backBtn);
    expect(screen.getByTestId('step1-name')).toBeTruthy();
  });
});
