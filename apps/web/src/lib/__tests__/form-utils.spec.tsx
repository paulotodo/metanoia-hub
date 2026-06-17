/**
 * Task 0.6 — testes unitários de form-utils
 * Cobertura: scrollToFirstError (SC-G), SubmitButton (SC-D)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { scrollToFirstError } from '../form-utils';
import { SubmitButton } from '../submit-button';

// ─── scrollToFirstError ───────────────────────────────────────────────────────

describe('scrollToFirstError', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('SC-G-1: chama scrollIntoView no primeiro elemento aria-invalid="true"', () => {
    const el = document.createElement('input');
    el.setAttribute('aria-invalid', 'true');
    const scrollSpy = vi.fn();
    el.scrollIntoView = scrollSpy;
    el.focus = vi.fn();
    document.body.appendChild(el);

    scrollToFirstError();

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('SC-G-2: chama focus no mesmo elemento com aria-invalid="true"', () => {
    const el = document.createElement('input');
    el.setAttribute('aria-invalid', 'true');
    el.scrollIntoView = vi.fn();
    const focusSpy = vi.fn();
    el.focus = focusSpy;
    document.body.appendChild(el);

    scrollToFirstError();

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('SC-G-3: retorna sem exceção (no-op) quando não há aria-invalid="true"', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);

    // Não deve lançar exceção
    expect(() => scrollToFirstError()).not.toThrow();
  });

  it('usa DOM order — seleciona o PRIMEIRO elemento inválido', () => {
    const first = document.createElement('input');
    first.setAttribute('aria-invalid', 'true');
    first.scrollIntoView = vi.fn();
    const focusSpy1 = vi.fn();
    first.focus = focusSpy1;

    const second = document.createElement('input');
    second.setAttribute('aria-invalid', 'true');
    second.scrollIntoView = vi.fn();
    second.focus = vi.fn();

    document.body.appendChild(first);
    document.body.appendChild(second);

    scrollToFirstError();

    expect(focusSpy1).toHaveBeenCalledTimes(1);
    expect(second.focus).not.toHaveBeenCalled();
  });
});

// ─── SubmitButton ─────────────────────────────────────────────────────────────

describe('SubmitButton — acessibilidade (jest-axe)', () => {
  it('SC-D-axe-idle: sem violações no estado idle', async () => {
    const { container } = render(
      <form>
        <SubmitButton label="Entrar" pendingLabel="Entrando…" isPending={false} />
      </form>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('SC-D-axe-pending: sem violações no estado pending', async () => {
    const { container } = render(
      <form>
        <SubmitButton label="Entrar" pendingLabel="Entrando…" isPending={true} />
      </form>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('SubmitButton — comportamento', () => {
  it('SC-D-1: isPending=false — exibe label, sem aria-busy, sem disabled', () => {
    render(
      <SubmitButton label="Enviar" pendingLabel="Enviando…" isPending={false} />,
    );
    const btn = screen.getByRole('button', { name: 'Enviar' });
    expect(btn.hasAttribute('disabled')).toBe(false);
    expect(btn.getAttribute('aria-busy')).not.toBe('true');
    expect(btn.textContent).toContain('Enviar');
  });

  it('SC-D-2: isPending=true — exibe pendingLabel, aria-busy=true, disabled', () => {
    render(
      <SubmitButton label="Enviar" pendingLabel="Enviando…" isPending={true} />,
    );
    const btn = screen.getByRole('button', { name: /enviando/i });
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.textContent).toContain('Enviando…');
  });

  it('SC-D-3: spinner usa aria-hidden="true"', () => {
    render(
      <SubmitButton label="Enviar" pendingLabel="Enviando…" isPending={true} />,
    );
    const btn = screen.getByRole('button');
    const spinner = btn.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeTruthy();
  });

  it('SC-D-4 (dec-028): transição isPending=true → false remove aria-busy', () => {
    const { rerender } = render(
      <SubmitButton label="Enviar" pendingLabel="Enviando…" isPending={true} />,
    );
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');

    rerender(<SubmitButton label="Enviar" pendingLabel="Enviando…" isPending={false} />);
    expect(screen.getByRole('button', { name: 'Enviar' }).getAttribute('aria-busy')).not.toBe('true');
  });

  it('passa atributos HTML restantes ao button', () => {
    render(
      <SubmitButton
        label="Salvar"
        pendingLabel="Salvando…"
        isPending={false}
        data-testid="save-btn"
        className="w-full"
      />,
    );
    const btn = screen.getByTestId('save-btn');
    expect(btn).toBeTruthy();
  });
});
