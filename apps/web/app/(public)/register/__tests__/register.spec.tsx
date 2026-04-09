import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { RegisterForm } from '../_components/register-form';

expect.extend(toHaveNoViolations);

describe('RegisterForm', () => {
  it('should render all form fields', () => {
    const { getByLabelText, getByRole } = render(<RegisterForm />);

    expect(getByLabelText('Nome completo')).toBeDefined();
    expect(getByLabelText('E-mail')).toBeDefined();
    expect(getByLabelText('Senha')).toBeDefined();
    expect(getByLabelText('Confirmar senha')).toBeDefined();
    expect(getByRole('button', { name: 'Criar conta' })).toBeDefined();
  });

  it('should render heading', () => {
    const { getByRole } = render(<RegisterForm />);
    expect(getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('should pass jest-axe accessibility checks', async () => {
    const { container } = render(<RegisterForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
