import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NetworkErrorState } from '../network-error-state';
import { ApiError } from '@/lib/api/client';

describe('<NetworkErrorState />', () => {
  it('renders skeleton while retrying', () => {
    render(<NetworkErrorState onRetry={() => {}} isRetrying />);
    expect(screen.getByTestId('network-error-skeleton')).toBeTruthy();
  });

  it('renders generic network message after retries are exhausted', () => {
    render(<NetworkErrorState onRetry={() => {}} />);
    expect(screen.getByText(/conexão/i)).toBeTruthy();
  });

  it('shows retry button that triggers callback', () => {
    const onRetry = vi.fn();
    render(<NetworkErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('uses ErrorMessage mapping when an ApiError is provided', () => {
    render(
      <NetworkErrorState
        error={new ApiError(503, 'ServiceUnavailable', 'down')}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(/imprevisto|conexão/i)).toBeTruthy();
  });

  it('skeleton has accessible role="status"', () => {
    render(<NetworkErrorState onRetry={() => {}} isRetrying />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
