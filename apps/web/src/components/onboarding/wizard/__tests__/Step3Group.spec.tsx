import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { Step3Group } from '../steps/Step3Group';
import type { OnboardingProgress } from '@metanoia/types';

const Wrapper = createQueryClientWrapper();

const DEFAULT_PROGRESS: OnboardingProgress = {
  currentStep: 3,
  completedSteps: [1, 2],
  stepData: {},
  completed: false,
  completedAt: null,
  skippedAt: null,
};

describe('Step3Group', () => {
  it('renders create-group radio option', () => {
    render(
      <Wrapper>
        <Step3Group currentProgress={DEFAULT_PROGRESS} onComplete={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('step3-mode-create')).toBeTruthy();
  });

  it('shows group name field when create option selected', () => {
    render(
      <Wrapper>
        <Step3Group currentProgress={DEFAULT_PROGRESS} onComplete={vi.fn()} />
      </Wrapper>,
    );
    const radio = screen.getByTestId('step3-mode-create');
    fireEvent.click(radio);
    expect(screen.getByTestId('step3-group-name')).toBeTruthy();
  });

  it('options disabled in readOnly mode', () => {
    render(
      <Wrapper>
        <Step3Group currentProgress={DEFAULT_PROGRESS} onComplete={vi.fn()} readOnly />
      </Wrapper>,
    );
    const radio = screen.getByTestId('step3-mode-create') as HTMLInputElement;
    expect(radio.disabled).toBe(true);
  });

  it('WCAG AA — no violations', async () => {
    const { container } = render(
      <Wrapper>
        <Step3Group currentProgress={DEFAULT_PROGRESS} onComplete={vi.fn()} />
      </Wrapper>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
