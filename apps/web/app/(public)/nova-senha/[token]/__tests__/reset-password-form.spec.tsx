import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ResetPasswordForm } from '../_components/reset-password-form';

expect.extend(toHaveNoViolations);

const VALID_TOKEN = '019756d0-0001-7000-8000-000000000099';
const EXPIRED_TOKEN = '019756d0-0001-7000-8000-000000000000';

function mockFetch(status: number, data?: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data ?? {}),
    }),
  );
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should show form when token is valid', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, { data: { valid: true, email: 'm***@i***.com' } }),
    );

    const { getByTestId } = render(
      <ResetPasswordForm token={VALID_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByTestId('new-password-input')).toBeDefined();
    });
  });

  it('should show expired state when token is 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404));

    const { getByTestId } = render(
      <ResetPasswordForm token={EXPIRED_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByTestId('reset-expired')).toBeDefined();
    });
  });

  it('should show used state when token is 409', async () => {
    vi.stubGlobal('fetch', mockFetch(409));

    const { getByTestId } = render(
      <ResetPasswordForm token={EXPIRED_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByTestId('reset-used')).toBeDefined();
    });
  });

  it('should render masked email when token is valid', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, { data: { valid: true, email: 'm***@i***.com' } }),
    );

    const { findByText } = render(
      <ResetPasswordForm token={VALID_TOKEN} />,
    );

    expect(await findByText('m***@i***.com')).toBeDefined();
  });

  it('should pass jest-axe accessibility checks in valid state', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, { data: { valid: true, email: 'm***@i***.com' } }),
    );

    const { container, getByTestId } = render(
      <ResetPasswordForm token={VALID_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByTestId('new-password-input')).toBeDefined();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should pass jest-axe accessibility checks in expired state', async () => {
    vi.stubGlobal('fetch', mockFetch(404));

    const { container, getByTestId } = render(
      <ResetPasswordForm token={EXPIRED_TOKEN} />,
    );

    await waitFor(() => {
      expect(getByTestId('reset-expired')).toBeDefined();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
