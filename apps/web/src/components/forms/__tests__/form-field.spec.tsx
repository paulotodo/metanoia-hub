/**
 * Task 0.5 — testes jest-axe do FormField
 * Cobertura: SC-F (axe), label-associado, variante fieldset, ids, aria-*
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { FormField } from '../form-field';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderTextField(props: {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
}) {
  return render(
    <FormField
      label={props.label ?? 'E-mail'}
      error={props.error}
      required={props.required}
      hint={props.hint}
    >
      <input type="email" />
    </FormField>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FormField — acessibilidade (jest-axe)', () => {
  it('renderiza sem violações axe no estado inicial', async () => {
    const { container } = renderTextField({ label: 'E-mail', required: true });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renderiza sem violações axe quando há erro', async () => {
    const { container } = renderTextField({
      label: 'E-mail',
      error: 'E-mail inválido',
      required: true,
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renderiza sem violações axe variante fieldset', async () => {
    const { container } = render(
      <FormField as="fieldset" label="Escolha uma opção" required>
        <div>
          <label>
            <input type="radio" name="opt" value="a" /> Opção A
          </label>
          <label>
            <input type="radio" name="opt" value="b" /> Opção B
          </label>
        </div>
      </FormField>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('FormField — label associado', () => {
  it('associa label ao input via htmlFor/id', () => {
    renderTextField({ label: 'Nome completo' });
    const input = screen.getByRole('textbox');
    const label = screen.getByText('Nome completo');
    // Label.htmlFor deve apontar para input.id
    expect(label.tagName).toBe('LABEL');
    expect((label as HTMLLabelElement).htmlFor).toBe(input.id);
  });

  it('injeta aria-required quando required=true', () => {
    renderTextField({ label: 'E-mail', required: true });
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('injeta aria-invalid quando há erro', () => {
    renderTextField({ label: 'E-mail', error: 'Campo obrigatório' });
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('NÃO injeta aria-invalid quando não há erro', () => {
    renderTextField({ label: 'E-mail' });
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('injeta aria-describedby apontando para mensagem de erro', () => {
    renderTextField({ label: 'E-mail', error: 'Campo obrigatório' });
    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    // O elemento com esse id deve conter o texto do erro
    const lastId = (describedBy ?? '').split(' ').pop() ?? '';
    const errorEl = document.getElementById(lastId);
    expect(errorEl).toBeTruthy();
    expect(errorEl?.textContent).toBe('Campo obrigatório');
  });

  it('injeta aria-describedby apontando para hint quando presente', () => {
    renderTextField({ label: 'Senha', hint: 'Mínimo 12 caracteres' });
    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const hintId = (describedBy ?? '').split(' ')[0];
    const hintEl = document.getElementById(hintId);
    expect(hintEl?.textContent).toBe('Mínimo 12 caracteres');
  });

  it('exibe mensagem de erro com role=alert', () => {
    renderTextField({ label: 'E-mail', error: 'E-mail inválido' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('E-mail inválido');
  });
});

describe('FormField — variante fieldset', () => {
  it('usa fieldset + legend para grupos', () => {
    const { container } = render(
      <FormField as="fieldset" label="Preferência">
        <div>
          <label>
            <input type="radio" name="pref" value="x" /> X
          </label>
        </div>
      </FormField>,
    );
    expect(container.querySelector('fieldset')).toBeTruthy();
    expect(container.querySelector('legend')?.textContent).toContain('Preferência');
  });
});
