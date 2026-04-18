import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { RecoveryForm } from '../_components/recovery-form';

expect.extend(toHaveNoViolations);

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { message: 'Se esse email existir na nossa base...' },
          }),
      }),
    ),
  );
});

describe('RecoveryForm', () => {
  it('should render email field and submit button', () => {
    const { getByLabelText, getByRole } = render(<RecoveryForm />);
    expect(getByLabelText('E-mail')).toBeDefined();
    expect(getByRole('button', { name: 'Enviar link' })).toBeDefined();
  });

  it('should render heading and back link', () => {
    const { getByRole } = render(<RecoveryForm />);
    expect(getByRole('heading', { level: 1 })).toBeDefined();
    expect(
      getByRole('link', { name: '← Voltar para o login' }),
    ).toBeDefined();
  });

  it('should show validation error for invalid email', async () => {
    const { getByTestId, getByRole } = render(<RecoveryForm />);
    const input = getByTestId('recovery-email-input');
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.click(getByRole('button', { name: 'Enviar link' }));

    await waitFor(() => {
      expect(getByRole('alert')).toBeDefined();
    });
  });

  it('should transition to sent state on valid submit', async () => {
    const { getByTestId, getByRole } = render(<RecoveryForm />);
    const input = getByTestId('recovery-email-input');
    fireEvent.change(input, { target: { value: 'marcos@igreja.com' } });
    fireEvent.click(getByRole('button', { name: 'Enviar link' }));

    await waitFor(() => {
      expect(getByTestId('recovery-sent')).toBeDefined();
    });
  });

  it('should pass jest-axe accessibility checks', async () => {
    const { container } = render(<RecoveryForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
