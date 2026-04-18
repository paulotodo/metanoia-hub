import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LoginForm } from '../_components/login-form';

describe('LoginForm — forgot password link', () => {
  it('should render "Esqueci minha senha" link', () => {
    const { getByRole } = render(<LoginForm />);
    const link = getByRole('link', { name: 'Esqueci minha senha' });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/recuperar-senha');
  });
});
