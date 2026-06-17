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

  it('should have permanent underline for link-in-text-block a11y (WCAG 2.1 SC 1.4.1)', () => {
    const { getByRole } = render(<LoginForm />);
    const link = getByRole('link', { name: 'Esqueci minha senha' });
    // Guardia: o underline deve ser PERMANENTE (não apenas no hover)
    // Ref: spec §US-2/FR-04, plan §B2, dec-021 — a11y-contraste-focus task 2.2
    const className = link.getAttribute('class') ?? '';
    expect(className).toContain('underline');
    // Garantir que NÃO seja apenas hover:underline (sem underline permanente)
    expect(className.replace(/hover:[^\s]*/g, '')).toContain('underline');
  });
});
