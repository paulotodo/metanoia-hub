import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { Step5Radar } from '../steps/Step5Radar';
import type { OnboardingProgress } from '@metanoia/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const Wrapper = createQueryClientWrapper();

const DEMO_PROGRESS: OnboardingProgress = {
  currentStep: 5,
  completedSteps: [1, 2, 3],
  stepData: { mode: 'demo' },
  completed: false,
  completedAt: null,
  skippedAt: null,
};

const REAL_PROGRESS: OnboardingProgress = {
  currentStep: 5,
  completedSteps: [1, 2, 3, 4],
  stepData: {},
  completed: false,
  completedAt: null,
  skippedAt: null,
};

describe('Step5Radar', () => {
  it('renders complete button when not readOnly', () => {
    render(
      <Wrapper>
        <Step5Radar
          currentProgress={DEMO_PROGRESS}
          hasRealGroups={false}
          onComplete={vi.fn()}
        />
      </Wrapper>,
    );
    expect(screen.getByTestId('step5-complete')).toBeTruthy();
  });

  it('complete button absent in readOnly mode', () => {
    render(
      <Wrapper>
        <Step5Radar
          currentProgress={DEMO_PROGRESS}
          hasRealGroups={false}
          onComplete={vi.fn()}
          readOnly
        />
      </Wrapper>,
    );
    expect(screen.queryByTestId('step5-complete')).toBeNull();
  });

  it('shows real-data section when hasRealGroups is true', () => {
    render(
      <Wrapper>
        <Step5Radar
          currentProgress={REAL_PROGRESS}
          hasRealGroups={true}
          onComplete={vi.fn()}
        />
      </Wrapper>,
    );
    // When hasRealGroups=true, renders the "Seus dados reais" section
    expect(screen.getByText(/seus dados reais/i)).toBeTruthy();
  });

  it('WCAG AA — no violations in demo mode', async () => {
    const { container } = render(
      <Wrapper>
        <Step5Radar
          currentProgress={DEMO_PROGRESS}
          hasRealGroups={false}
          onComplete={vi.fn()}
        />
      </Wrapper>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
