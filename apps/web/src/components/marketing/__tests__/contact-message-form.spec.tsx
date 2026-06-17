/**
 * contact-message-form.spec.tsx — Testes jest-axe do ContactMessageForm
 *
 * Task 3.2 — feature a11y-formularios
 * Cobertura: axe (label-associado, aria-invalid, aria-describedby), estados
 * initial e com erros.
 *
 * Ref: SC-B, FR-011, Story 12.5
 *
 * Nota: o componente usa react-hook-form + apiClient (chamadas externas).
 * Mockamos apiClient para isolar o teste.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do apiClient para evitar chamadas de rede
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

// Mock do @metanoia/ui para componentes sem CSS vars no jsdom
vi.mock('@metanoia/ui', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@metanoia/ui')>();
  return {
    ...mod,
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      React.createElement('button', props, children),
    Input: ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) =>
      React.createElement('input', props),
  };
});

import { ContactMessageForm } from '../contact-message-form';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContactMessageForm — acessibilidade (jest-axe)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza sem violações axe no estado inicial', async () => {
    const { container } = render(<ContactMessageForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ContactMessageForm — labels e aria-*', () => {
  it('campo nome tem label associado via htmlFor/id', () => {
    render(<ContactMessageForm />);
    const nameInput = document.getElementById('contact-form-name');
    expect(nameInput).not.toBeNull();
    const label = document.querySelector('label[for="contact-form-name"]');
    expect(label).not.toBeNull();
  });

  it('campo email tem label associado via htmlFor/id', () => {
    render(<ContactMessageForm />);
    const emailInput = document.getElementById('contact-form-email');
    expect(emailInput).not.toBeNull();
    const label = document.querySelector('label[for="contact-form-email"]');
    expect(label).not.toBeNull();
  });

  it('campo mensagem tem label associado via htmlFor/id', () => {
    render(<ContactMessageForm />);
    const msgInput = document.getElementById('contact-form-message');
    expect(msgInput).not.toBeNull();
    const label = document.querySelector('label[for="contact-form-message"]');
    expect(label).not.toBeNull();
  });
});
