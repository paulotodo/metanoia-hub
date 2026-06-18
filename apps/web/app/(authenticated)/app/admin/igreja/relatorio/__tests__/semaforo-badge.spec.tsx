/**
 * semaforo-badge.spec.tsx — Testes jest-axe do badge de semáforo pastoral.
 *
 * FASE 5.7 — feature relatorio-tenant-mv (Story 13.2b)
 * Cobertura: axe (sem violações) + verifica que o significado NÃO depende só
 * de cor (ícone aria-hidden + texto visível — WCAG 1.4.1).
 *
 * Nota: o projeto NÃO usa jest-dom matchers — apenas jest-axe + asserções
 * nativas do vitest (getByX lança quando não encontra).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { SemaforoBadge, type Semaforo } from '../_components/semaforo-badge';

const STATUSES: Semaforo[] = ['verde', 'amarelo', 'vermelho'];

describe('SemaforoBadge — acessibilidade (jest-axe)', () => {
  it.each(STATUSES)('renderiza sem violações axe (%s)', async (status) => {
    const { container } = render(<SemaforoBadge status={status} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('exibe texto além da cor (WCAG 1.4.1)', () => {
    render(<SemaforoBadge status="vermelho" />);
    const badge = screen.getByTestId('semaforo-vermelho');
    // O label textual deve estar presente — informação não só por cor
    expect(badge.textContent).toContain('Cuidado urgente');
  });

  it('o ícone é aria-hidden (não lido por leitores de tela)', () => {
    const { container } = render(<SemaforoBadge status="amarelo" />);
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).not.toBeNull();
  });
});
