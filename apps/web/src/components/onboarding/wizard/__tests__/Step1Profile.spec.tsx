import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { Step1Profile } from '../steps/Step1Profile';

const Wrapper = createQueryClientWrapper();

describe('Step1Profile', () => {
  it('renders name and role-title fields', () => {
    render(
      <Wrapper>
        <Step1Profile onComplete={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('step1-name')).toBeTruthy();
    expect(screen.getByTestId('step1-role-title')).toBeTruthy();
  });

  it('renders file input for photo upload', () => {
    render(
      <Wrapper>
        <Step1Profile onComplete={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('step1-photo-input')).toBeTruthy();
  });

  it('submit button is present when not readOnly', () => {
    render(
      <Wrapper>
        <Step1Profile onComplete={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('step1-submit')).toBeTruthy();
  });

  it('submit button absent in readOnly mode', () => {
    render(
      <Wrapper>
        <Step1Profile onComplete={vi.fn()} readOnly />
      </Wrapper>,
    );
    expect(screen.queryByTestId('step1-submit')).toBeNull();
  });

  it('fields are disabled in readOnly mode', () => {
    render(
      <Wrapper>
        <Step1Profile onComplete={vi.fn()} readOnly />
      </Wrapper>,
    );
    const nameInput = screen.getByTestId('step1-name') as HTMLInputElement;
    expect(nameInput.disabled).toBe(true);
  });

  it('calls onComplete with empty advance if name is empty', async () => {
    const onComplete = vi.fn();
    render(
      <Wrapper>
        <Step1Profile onComplete={onComplete} />
      </Wrapper>,
    );
    const submit = screen.getByTestId('step1-submit');
    fireEvent.click(submit);
    // onComplete called even with empty name (nothing to save)
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it('WCAG AA — no violations', async () => {
    const { container } = render(
      <Wrapper>
        <Step1Profile onComplete={vi.fn()} />
      </Wrapper>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
