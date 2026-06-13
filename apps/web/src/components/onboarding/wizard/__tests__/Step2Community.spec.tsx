import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { Step2Community } from '../steps/Step2Community';

const Wrapper = createQueryClientWrapper();

describe('Step2Community', () => {
  it('renders community name, denomination, city, state fields', () => {
    render(
      <Wrapper>
        <Step2Community onComplete={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('step2-community-name')).toBeTruthy();
    expect(screen.getByTestId('step2-denomination')).toBeTruthy();
    expect(screen.getByTestId('step2-city')).toBeTruthy();
    expect(screen.getByTestId('step2-state')).toBeTruthy();
  });

  it('submit button absent in readOnly mode', () => {
    render(
      <Wrapper>
        <Step2Community onComplete={vi.fn()} readOnly />
      </Wrapper>,
    );
    expect(screen.queryByTestId('step2-submit')).toBeNull();
  });

  it('fields disabled in readOnly mode', () => {
    render(
      <Wrapper>
        <Step2Community onComplete={vi.fn()} readOnly />
      </Wrapper>,
    );
    const nameInput = screen.getByTestId('step2-community-name') as HTMLInputElement;
    expect(nameInput.disabled).toBe(true);
  });

  it('WCAG AA — no violations', async () => {
    const { container } = render(
      <Wrapper>
        <Step2Community onComplete={vi.fn()} />
      </Wrapper>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
