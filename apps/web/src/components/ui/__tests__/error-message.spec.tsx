import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorMessage } from '../error-message';
import { ApiError } from '@/lib/api/client';

describe('<ErrorMessage />', () => {
  it('renders mapped message from ApiError', () => {
    render(
      <ErrorMessage error={new ApiError(403, 'Forbidden', 'denied at backend')} />,
    );
    expect(screen.getByText(/permissão para esta ação/i)).toBeTruthy();
  });

  it('uses errorKey when provided', () => {
    render(<ErrorMessage errorKey="network.failed" />);
    expect(screen.getByText(/conexão/i)).toBeTruthy();
  });

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage errorKey="network.failed" onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: /tentar novamente/i });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('hides retry button when onRetry is omitted', () => {
    render(<ErrorMessage errorKey="permission.denied" />);
    expect(
      screen.queryByRole('button', { name: /tentar novamente/i }),
    ).toBeNull();
  });

  it('exposes role="alert" for screen readers', () => {
    render(<ErrorMessage errorKey="unknown.generic" />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('falls back to unknown.generic for invalid keys', () => {
    render(<ErrorMessage errorKey="does.not.exist" />);
    expect(screen.getByText(/imprevisto/i)).toBeTruthy();
  });

  it('never displays raw backend technical messages', () => {
    render(
      <ErrorMessage
        error={new ApiError(500, 'InternalServerError', 'TypeError at line 42')}
      />,
    );
    expect(screen.queryByText(/TypeError/i)).toBeNull();
    expect(screen.queryByText(/line 42/i)).toBeNull();
  });
});
