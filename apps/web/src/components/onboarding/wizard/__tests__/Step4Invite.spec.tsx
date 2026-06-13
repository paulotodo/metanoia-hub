import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { Step4Invite } from '../steps/Step4Invite';

const Wrapper = createQueryClientWrapper();

describe('Step4Invite', () => {
  it('renders leader name and email fields', () => {
    render(
      <Wrapper>
        <Step4Invite onComplete={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('step4-leader-name')).toBeTruthy();
    expect(screen.getByTestId('step4-leader-email')).toBeTruthy();
  });

  it('renders skip button', () => {
    render(
      <Wrapper>
        <Step4Invite onComplete={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('step4-skip')).toBeTruthy();
  });

  it('calls onComplete(true) when skip is clicked', () => {
    const onComplete = vi.fn();
    render(
      <Wrapper>
        <Step4Invite onComplete={onComplete} />
      </Wrapper>,
    );
    fireEvent.click(screen.getByTestId('step4-skip'));
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('shows email validation error for invalid email', async () => {
    render(
      <Wrapper>
        <Step4Invite onComplete={vi.fn()} />
      </Wrapper>,
    );
    // Fill name and invalid email
    fireEvent.change(screen.getByTestId('step4-leader-name'), {
      target: { value: 'João' },
    });
    fireEvent.change(screen.getByTestId('step4-leader-email'), {
      target: { value: 'not-an-email' },
    });
    // Submit the form directly (bypasses button disabled check)
    const form = screen.getByTestId('step4-leader-name').closest('form')!;
    fireEvent.submit(form);
    // Error message appears after handleSubmit sets state
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('submit and skip absent in readOnly mode', () => {
    render(
      <Wrapper>
        <Step4Invite onComplete={vi.fn()} readOnly />
      </Wrapper>,
    );
    expect(screen.queryByTestId('step4-invite-submit')).toBeNull();
    expect(screen.queryByTestId('step4-skip')).toBeNull();
  });

  it('WCAG AA — no violations', async () => {
    const { container } = render(
      <Wrapper>
        <Step4Invite onComplete={vi.fn()} />
      </Wrapper>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
