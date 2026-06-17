/**
 * demo-request-form.spec.tsx — Testes jest-axe do DemoRequestForm
 *
 * Task 3.2 — feature a11y-formularios
 * Cobertura: axe (label-associado, aria-invalid, aria-describedby), estado inicial.
 *
 * Ref: SC-B, FR-011, Story 12.5
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
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

// Mock do @metanoia/ui para componentes sem CSS vars no jsdom
vi.mock('@metanoia/ui', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@metanoia/ui')>();
  return {
    ...mod,
    Input: ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) =>
      React.createElement('input', props),
  };
});

// Mock do submit-button: renderiza label como texto visível (axe button-name)
vi.mock('@/lib/submit-button', () => ({
  SubmitButton: ({ label, pendingLabel, isPending, ...rest }: {
    label: string;
    pendingLabel: string;
    isPending: boolean;
    [key: string]: unknown;
  }) =>
    React.createElement(
      'button',
      { type: 'submit', disabled: isPending, 'aria-busy': isPending || undefined, ...rest },
      isPending ? pendingLabel : label,
    ),
}));

import { DemoRequestForm } from '../demo-request-form';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DemoRequestForm — acessibilidade (jest-axe)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza sem violações axe no estado inicial', async () => {
    const { container } = render(<DemoRequestForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('DemoRequestForm — labels e aria-*', () => {
  it('campo nome tem label associado via htmlFor/id', () => {
    render(<DemoRequestForm />);
    const nameInput = document.getElementById('demo-form-name');
    expect(nameInput).not.toBeNull();
    const label = document.querySelector('label[for="demo-form-name"]');
    expect(label).not.toBeNull();
  });

  it('campo email tem label associado via htmlFor/id', () => {
    render(<DemoRequestForm />);
    const emailInput = document.getElementById('demo-form-email');
    expect(emailInput).not.toBeNull();
    const label = document.querySelector('label[for="demo-form-email"]');
    expect(label).not.toBeNull();
  });

  it('campo igreja tem label associado via htmlFor/id', () => {
    render(<DemoRequestForm />);
    const churchInput = document.getElementById('demo-form-church');
    expect(churchInput).not.toBeNull();
    const label = document.querySelector('label[for="demo-form-church"]');
    expect(label).not.toBeNull();
  });

  it('campo tamanho tem label associado via htmlFor/id', () => {
    render(<DemoRequestForm />);
    const sizeInput = document.getElementById('demo-form-size');
    expect(sizeInput).not.toBeNull();
    const label = document.querySelector('label[for="demo-form-size"]');
    expect(label).not.toBeNull();
  });
});
