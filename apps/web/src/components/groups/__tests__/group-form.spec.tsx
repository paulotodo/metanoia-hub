/**
 * group-form.spec.tsx — Testes jest-axe e comportamento do GroupForm
 *
 * Task 3.2 — feature a11y-formularios
 * Cobertura: axe (label-associado, aria-required, aria-describedby), estados
 * initial, pending, onSuccess, onCancel.
 *
 * Ref: SC-B, FR-008, Story 12.2, dec-027
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { GroupForm } from '../group-form';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// useAsyncAnnouncer usa contexto de portal — mock simples para unit tests
vi.mock('@/components/a11y/async-announcer', () => ({
  useAsyncAnnouncer: () => ({ announce: vi.fn() }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderGroupForm(props: Partial<React.ComponentProps<typeof GroupForm>> = {}) {
  const defaults = {
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
    pending: false,
  };
  return render(<GroupForm {...defaults} {...props} />);
}

// ─── 1. jest-axe — sem violações ─────────────────────────────────────────────

describe('GroupForm — acessibilidade (jest-axe)', () => {
  it('renderiza sem violações axe no estado inicial', async () => {
    const { container } = renderGroupForm();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renderiza sem violações axe no estado pending', async () => {
    const { container } = renderGroupForm({ pending: true });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renderiza sem violações axe com valores iniciais (modo edição)', async () => {
    const { container } = renderGroupForm({
      initialValues: {
        name: 'Célula Norte',
        dayOfWeek: 'monday',
        time: '19:00',
        description: 'Reunião semanal',
      },
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renderiza sem violações axe sem botão cancelar', async () => {
    const { container } = render(
      <GroupForm onSuccess={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ─── 2. Labels e aria-* ──────────────────────────────────────────────────────

describe('GroupForm — labels e aria-required', () => {
  it('campo nome tem label associado via htmlFor/id', () => {
    renderGroupForm();
    const nameInput = document.getElementById('group-name');
    expect(nameInput).not.toBeNull();
    const label = document.querySelector('label[for="group-name"]');
    expect(label).not.toBeNull();
  });

  it('campo nome tem aria-required="true"', () => {
    renderGroupForm();
    const nameInput = document.getElementById('group-name') as HTMLInputElement;
    expect(nameInput?.getAttribute('aria-required')).toBe('true');
  });

  it('campo nome tem aria-describedby apontando para span de erro', () => {
    renderGroupForm();
    const nameInput = document.getElementById('group-name') as HTMLInputElement;
    const describedById = nameInput?.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const errorEl = document.getElementById(describedById ?? '');
    expect(errorEl).not.toBeNull();
  });

  it('botão submit tem aria-busy quando pending=true', () => {
    renderGroupForm({ pending: true });
    const btn = screen.getByTestId('group-form-submit');
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('botão submit NÃO tem aria-busy quando pending=false', () => {
    renderGroupForm({ pending: false });
    const btn = screen.getByTestId('group-form-submit');
    expect(btn.getAttribute('aria-busy')).toBeNull();
  });
});

// ─── 3. Comportamento ────────────────────────────────────────────────────────

describe('GroupForm — comportamento', () => {
  it('chama onSuccess com os valores do form no submit', () => {
    const onSuccess = vi.fn();
    renderGroupForm({ onSuccess });

    const nameInput = screen.getByRole('textbox', { name: /nome/i });
    fireEvent.change(nameInput, { target: { value: 'Célula Sul' } });

    const form = screen.getByTestId('group-form');
    fireEvent.submit(form);

    expect(onSuccess).toHaveBeenCalledOnce();
    const [values] = onSuccess.mock.calls[0];
    expect(values.name).toBe('Célula Sul');
  });

  it('chama onCancel ao clicar em Cancelar', () => {
    const onCancel = vi.fn();
    renderGroupForm({ onCancel });

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('campos ficam disabled quando pending=true', () => {
    renderGroupForm({ pending: true });
    const nameInput = document.getElementById('group-name') as HTMLInputElement;
    expect(nameInput?.disabled).toBe(true);
  });
});
