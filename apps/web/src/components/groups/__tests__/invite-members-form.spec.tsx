/**
 * invite-members-form.spec.tsx — Testes jest-axe e comportamento do InviteMembersForm
 *
 * Task 3.2 — feature a11y-formularios
 * Cobertura: axe (label-associado, aria-label, aria-disabled), estados
 * initial, pending, onInviteEmail, onUploadCsv.
 *
 * Ref: SC-B, FR-010, Story 12.2, dec-027
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { InviteMembersForm } from '../invite-members-form';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderInviteForm(props: Partial<React.ComponentProps<typeof InviteMembersForm>> = {}) {
  const defaults = {
    onInviteEmail: vi.fn(),
    onUploadCsv: vi.fn(),
    pending: false,
  };
  return render(<InviteMembersForm {...defaults} {...props} />);
}

// ─── 1. jest-axe — sem violações ─────────────────────────────────────────────

describe('InviteMembersForm — acessibilidade (jest-axe)', () => {
  it('renderiza sem violações axe no estado inicial', async () => {
    const { container } = renderInviteForm();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renderiza sem violações axe no estado pending', async () => {
    const { container } = renderInviteForm({ pending: true });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ─── 2. Labels e aria-* ──────────────────────────────────────────────────────

describe('InviteMembersForm — labels e aria-*', () => {
  it('input de email tem label associado via htmlFor/id', () => {
    renderInviteForm();
    const emailInput = document.getElementById('invite-email');
    expect(emailInput).not.toBeNull();
    const label = document.querySelector('label[for="invite-email"]');
    expect(label).not.toBeNull();
  });

  it('input file tem aria-label descritivo', () => {
    renderInviteForm();
    const fileInput = screen.getByTestId('upload-csv-input') as HTMLInputElement;
    const ariaLabel = fileInput.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.length).toBeGreaterThan(10);
  });

  it('botão de upload CSV é focável via tabIndex', () => {
    renderInviteForm();
    const uploadBtn = screen.getByTestId('upload-csv-button');
    // tabIndex 0 = participante natural do tab order
    expect(uploadBtn.getAttribute('tabindex')).toBe('0');
  });

  it('botão de upload tem aria-disabled quando pending=true', () => {
    renderInviteForm({ pending: true });
    const uploadBtn = screen.getByTestId('upload-csv-button');
    expect(uploadBtn.getAttribute('aria-disabled')).toBeTruthy();
  });

  it('form de email tem aria-label descritivo', () => {
    renderInviteForm();
    const form = document.querySelector('form[aria-label]');
    expect(form).not.toBeNull();
    expect(form?.getAttribute('aria-label')?.length).toBeGreaterThan(5);
  });
});

// ─── 3. Comportamento ────────────────────────────────────────────────────────

describe('InviteMembersForm — comportamento', () => {
  it('chama onInviteEmail com o email digitado no submit', () => {
    const onInviteEmail = vi.fn();
    renderInviteForm({ onInviteEmail });

    const emailInput = screen.getByTestId('invite-email-input');
    fireEvent.change(emailInput, { target: { value: 'joao@exemplo.com' } });

    const form = emailInput.closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    expect(onInviteEmail).toHaveBeenCalledWith('joao@exemplo.com');
  });

  it('input de email fica disabled quando pending=true', () => {
    renderInviteForm({ pending: true });
    const emailInput = screen.getByTestId('invite-email-input') as HTMLInputElement;
    expect(emailInput.disabled).toBe(true);
  });

  it('input file fica disabled quando pending=true', () => {
    renderInviteForm({ pending: true });
    const fileInput = screen.getByTestId('upload-csv-input') as HTMLInputElement;
    expect(fileInput.disabled).toBe(true);
  });
});
