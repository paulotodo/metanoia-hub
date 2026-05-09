import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const reportErrorMock = vi.fn();
vi.mock('@/lib/observability/report-error', () => ({
  reportError: (...args: unknown[]) => reportErrorMock(...args),
}));

import { BoundaryFallback } from '../boundary-fallback';

describe('<BoundaryFallback />', () => {
  beforeEach(() => {
    reportErrorMock.mockClear();
  });

  it('renders friendly title and description (no white screen)', () => {
    render(
      <BoundaryFallback error={new Error('boom')} reset={() => {}} route="x" />,
    );
    expect(screen.getByText(/algo não saiu como esperado/i)).toBeTruthy();
    expect(screen.getByText(/imprevisto ao carregar/i)).toBeTruthy();
  });

  it('exposes role="alert" for screen readers', () => {
    render(
      <BoundaryFallback error={new Error('boom')} reset={() => {}} route="x" />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('reset button invokes the provided reset callback', () => {
    const reset = vi.fn();
    render(
      <BoundaryFallback error={new Error('boom')} reset={reset} route="x" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('reports the error to the observability endpoint with route + digest', () => {
    const error: Error & { digest?: string } = Object.assign(
      new Error('boom'),
      { digest: 'd-1' },
    );
    render(
      <BoundaryFallback error={error} reset={() => {}} route="authenticated" />,
    );

    expect(reportErrorMock).toHaveBeenCalledOnce();
    const call = reportErrorMock.mock.calls[0];
    expect(call?.[0]).toBe(error);
    expect(call?.[1]).toMatchObject({ route: 'authenticated', digest: 'd-1' });
  });

  it('never displays raw error message or stack', () => {
    const err = new Error('TypeError: cannot read .x at line 99');
    render(<BoundaryFallback error={err} reset={() => {}} route="x" />);
    expect(screen.queryByText(/TypeError/i)).toBeNull();
    expect(screen.queryByText(/line 99/i)).toBeNull();
  });
});
