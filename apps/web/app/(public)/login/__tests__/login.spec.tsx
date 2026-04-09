import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoginForm } from '../_components/login-form';

expect.extend(toHaveNoViolations);

describe('LoginForm', () => {
  it('should render all form fields', () => {
    const { getByLabelText, getByRole } = render(<LoginForm />);

    expect(getByLabelText('E-mail')).toBeDefined();
    expect(getByLabelText('Senha')).toBeDefined();
    expect(getByRole('button', { name: 'Entrar' })).toBeDefined();
  });

  it('should render heading', () => {
    const { getByRole } = render(<LoginForm />);
    expect(getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('should render Google login button', () => {
    const { getByRole } = render(<LoginForm />);
    expect(getByRole('button', { name: 'Entrar com Google' })).toBeDefined();
  });

  it('should render link to register page', () => {
    const { getByRole } = render(<LoginForm />);
    expect(getByRole('link', { name: 'Criar conta' })).toBeDefined();
  });

  it('should pass jest-axe accessibility checks', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
