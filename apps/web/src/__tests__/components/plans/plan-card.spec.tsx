/**
 * plan-card.spec.tsx — Testes de acessibilidade para PlanCard e UpgradeDialog (US7)
 *
 * Story 12.2 — US7, FR-022, FR-023, FR-024
 * dec-011: focus trap via Radix Dialog (shadcn/ui)
 *
 * Cobre:
 *   - jest-axe: 0 violations WCAG nos componentes (AC da task 8.1)
 *   - Tab order: cards têm tabIndex=0 (FR-022)
 *   - Enter/Space expande detalhes do card (FR-022)
 *   - CTAs são buttons nativos focáveis (FR-023)
 *   - UpgradeDialog: aria-modal, role=dialog, aria-labelledby (FR-024)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PlanCard, type PlanCardProps } from '@/components/plans/plan-card';
import { UpgradeDialog } from '@/components/plans/upgrade-dialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAN_FREE: PlanCardProps = {
  planId: 'free',
  name: 'Gratuito',
  price: 'R$ 0 / mês',
  description: 'Para igrejas que estão começando.',
  features: ['Até 50 membros', 'Radar básico'],
  cta: 'Plano atual',
  ctaVariant: 'outline',
  highlighted: false,
  onUpgradeClick: vi.fn(),
};

const PLAN_PRO: PlanCardProps = {
  planId: 'pro',
  name: 'Pro',
  price: 'R$ 149 / mês',
  description: 'Para igrejas em crescimento.',
  features: ['Membros ilimitados', 'Radar avançado', 'Suporte prioritário'],
  cta: 'Assinar Pro',
  ctaVariant: 'primary',
  highlighted: true,
  onUpgradeClick: vi.fn(),
};

// ---------------------------------------------------------------------------
// PlanCard
// ---------------------------------------------------------------------------

describe('PlanCard — acessibilidade por teclado (FASE 8, US7)', () => {
  // ── jest-axe ──────────────────────────────────────────────────────────────

  it('sem violações WCAG (jest-axe) — card Gratuito', async () => {
    const { container } = render(<PlanCard {...PLAN_FREE} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sem violações WCAG (jest-axe) — card Pro (highlighted)', async () => {
    const { container } = render(<PlanCard {...PLAN_PRO} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── FR-022: cards focáveis com tabIndex=0 ─────────────────────────────────

  it('FR-022: card tem tabIndex=0 e role=article', () => {
    const { getByTestId } = render(<PlanCard {...PLAN_FREE} />);
    const card = getByTestId('plan-card-free');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('role')).toBe('article');
  });

  it('FR-022: card tem aria-label descritivo', () => {
    const { getByTestId } = render(<PlanCard {...PLAN_FREE} />);
    const card = getByTestId('plan-card-free');
    expect(card.getAttribute('aria-label')).toBe('Plano Gratuito');
  });

  // ── FR-022: Enter expande detalhes ────────────────────────────────────────

  it('FR-022: Enter no card expande detalhes (aria-expanded muda)', () => {
    const { getByTestId } = render(<PlanCard {...PLAN_FREE} />);
    const card = getByTestId('plan-card-free');

    // Inicialmente fechado
    expect(card.getAttribute('aria-expanded')).toBe('false');

    // Enter expande
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(card.getAttribute('aria-expanded')).toBe('true');

    // Enter novamente fecha
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(card.getAttribute('aria-expanded')).toBe('false');
  });

  it('FR-022: Space no card expande detalhes', () => {
    const { getByTestId } = render(<PlanCard {...PLAN_FREE} />);
    const card = getByTestId('plan-card-free');
    fireEvent.keyDown(card, { key: ' ' });
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });

  it('FR-022: click no card expande detalhes', () => {
    const { getByTestId } = render(<PlanCard {...PLAN_FREE} />);
    const card = getByTestId('plan-card-free');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });

  // ── FR-023: CTAs focáveis e ativáveis ────────────────────────────────────

  it('FR-023: CTA é button nativo com aria-label descritivo', () => {
    const { getByTestId } = render(<PlanCard {...PLAN_PRO} />);
    const cta = getByTestId('plan-card-pro-cta');
    expect(cta.tagName).toBe('BUTTON');
    const label = cta.getAttribute('aria-label') ?? '';
    expect(label).toContain('Assinar Pro');
    expect(label).toContain('Pro');
  });

  it('FR-023: click no CTA chama onUpgradeClick com planId correto', () => {
    const mockUpgrade = vi.fn();
    const { getByTestId } = render(
      <PlanCard {...PLAN_PRO} onUpgradeClick={mockUpgrade} />,
    );
    const cta = getByTestId('plan-card-pro-cta');
    fireEvent.click(cta);
    expect(mockUpgrade).toHaveBeenCalledWith('pro');
  });

  it('FR-023: Enter no CTA chama onUpgradeClick', () => {
    const mockUpgrade = vi.fn();
    const { getByTestId } = render(
      <PlanCard {...PLAN_PRO} onUpgradeClick={mockUpgrade} />,
    );
    const cta = getByTestId('plan-card-pro-cta');
    fireEvent.keyDown(cta, { key: 'Enter' });
    expect(mockUpgrade).toHaveBeenCalledWith('pro');
  });

  it('FR-023: click no CTA não propaga expand do card', () => {
    const mockUpgrade = vi.fn();
    const { getByTestId } = render(
      <PlanCard {...PLAN_PRO} onUpgradeClick={mockUpgrade} />,
    );
    const card = getByTestId('plan-card-pro');
    const cta = getByTestId('plan-card-pro-cta');

    // Card inicia fechado
    expect(card.getAttribute('aria-expanded')).toBe('false');

    // Click no CTA não deve expandir o card
    fireEvent.click(cta);
    expect(card.getAttribute('aria-expanded')).toBe('false');
  });

  // ── Detalhes da região expandida ─────────────────────────────────────────

  it('FR-022: região de detalhes tem role=region com aria-label', () => {
    const { container } = render(<PlanCard {...PLAN_FREE} />);
    const region = container.querySelector('[role="region"][aria-label*="Gratuito"]');
    expect(region).not.toBeNull();
  });

  it('FR-022: aria-controls aponta para a região de detalhes', () => {
    const { getByTestId } = render(<PlanCard {...PLAN_FREE} />);
    const card = getByTestId('plan-card-free');
    const controlsId = card.getAttribute('aria-controls') ?? '';
    expect(controlsId).toBeTruthy();
    const region = document.getElementById(controlsId);
    expect(region).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UpgradeDialog — FR-024: focus trap + ARIA
// ---------------------------------------------------------------------------

describe('UpgradeDialog — focus trap e ARIA (FR-024)', () => {
  it('sem violações WCAG (jest-axe) quando aberto', async () => {
    const { container } = render(
      <UpgradeDialog
        open={true}
        planId="pro"
        planName="Pro"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('FR-024: diálogo tem role=dialog quando aberto', () => {
    render(
      <UpgradeDialog
        open={true}
        planId="pro"
        planName="Pro"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toBeNull();
  });

  it('FR-024: botão de confirmar tem aria-label descritivo com nome do plano', () => {
    render(
      <UpgradeDialog
        open={true}
        planId="pro"
        planName="Pro"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const confirmBtn = screen.getByTestId('upgrade-dialog-confirm');
    const label = confirmBtn.getAttribute('aria-label') ?? '';
    expect(label).toContain('Pro');
  });

  it('FR-024: botão cancelar chama onClose', () => {
    const mockClose = vi.fn();
    render(
      <UpgradeDialog
        open={true}
        planId="pro"
        planName="Pro"
        onConfirm={vi.fn()}
        onClose={mockClose}
      />,
    );
    const cancelBtn = screen.getByTestId('upgrade-dialog-cancel');
    fireEvent.click(cancelBtn);
    expect(mockClose).toHaveBeenCalled();
  });

  it('FR-024: botão confirmar chama onConfirm com planId correto', () => {
    const mockConfirm = vi.fn();
    const mockClose = vi.fn();
    render(
      <UpgradeDialog
        open={true}
        planId="pro"
        planName="Pro"
        onConfirm={mockConfirm}
        onClose={mockClose}
      />,
    );
    const confirmBtn = screen.getByTestId('upgrade-dialog-confirm');
    fireEvent.click(confirmBtn);
    expect(mockConfirm).toHaveBeenCalledWith('pro');
  });

  it('FR-024: diálogo fechado não renderiza role=dialog', () => {
    render(
      <UpgradeDialog
        open={false}
        planId="pro"
        planName="Pro"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.queryByRole('dialog');
    expect(dialog).toBeNull();
  });

  it('FR-024: diálogo tem aria-labelledby e título contém nome do plano', () => {
    render(
      <UpgradeDialog
        open={true}
        planId="pro"
        planName="Pro"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    // Radix renderiza título em portal — usar screen.getByRole que busca no documento inteiro
    const heading = screen.getByRole('heading', { name: /Pro/i });
    expect(heading).not.toBeNull();
    expect(heading.textContent).toContain('Pro');
  });
});
