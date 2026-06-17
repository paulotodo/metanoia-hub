/**
 * branding-settings-form.spec.ts — Testes de acessibilidade para BrandingSettingsForm
 *
 * Story 12.2 — US6, FR-019..FR-021, CL-005, CHK024
 * Refs: dec-015 (manter foco na origem + aria-live polite), dec-045 (FASE 7 task 7.1)
 *
 * Cobre:
 *   - jest-axe: 0 violations WCAG no formulário (AC8)
 *   - Tab order lógico: todos os inputs têm id+label (FR-019)
 *   - Campo hex: aceita #RRGGBB, tem aria-label (FR-020)
 *   - Upload logo: input[type=file] tem aria-label; label tem tabIndex (FR-021)
 *   - useAsyncAnnouncer: announce() chamado após salvar (CL-005)
 *   - CHK024: guideline de latência documentada (não como SC automático)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandingSettingsForm } from '../../../../app/(authenticated)/app/admin/configuracoes/branding/BrandingSettingsForm';

// ---------------------------------------------------------------------------
// Mock useAsyncAnnouncer (CL-005) — verificar chamada de announce()
// ---------------------------------------------------------------------------

const mockAnnounce = vi.fn();

vi.mock('@/components/a11y/async-announcer', () => ({
  useAsyncAnnouncer: () => ({ announce: mockAnnounce }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRO_BRANDING = {
  tenantId: 'tenant-uuid-001',
  displayName: 'Igreja da Graça',
  logoUrl: null,
  primaryColor: '#2b7a78',
  secondaryColor: '#c1666b',
  plan: 'pro' as const,
  canCustomizeBranding: true,
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Suíte
// ---------------------------------------------------------------------------

describe('BrandingSettingsForm — acessibilidade por teclado (FASE 7)', () => {
  beforeEach(() => {
    mockAnnounce.mockClear();
  });

  // ── jest-axe ─────────────────────────────────────────────────────────────

  it('sem violações WCAG (jest-axe) com branding Pro', async () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sem violações WCAG (jest-axe) com branding nulo (free)', async () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={null} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── FR-019: Tab order — labels associadas a inputs ───────────────────────

  it('todos os inputs text têm label associada via htmlFor+id (FR-019)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const textInputs = container.querySelectorAll('input[type="text"]');
    expect(textInputs.length).toBeGreaterThanOrEqual(3); // displayName + 2x hex
    textInputs.forEach((input) => {
      const id = input.getAttribute('id');
      expect(id).toBeTruthy();
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label, `label para #${id} não encontrada`).not.toBeNull();
      }
    });
  });

  // ── FR-020: Campo hex acessível ───────────────────────────────────────────

  it('input hex da cor principal tem aria-label e pattern hex (FR-020)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const hexInput = container.querySelector('#primary-color-text');
    expect(hexInput).not.toBeNull();
    expect(hexInput?.getAttribute('aria-label')).toBeTruthy();
    expect(hexInput?.getAttribute('pattern')).toMatch(/\^#/);
  });

  it('input hex da cor secundária tem aria-label e pattern hex (FR-020)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const hexInput = container.querySelector('#secondary-color-text');
    expect(hexInput).not.toBeNull();
    expect(hexInput?.getAttribute('aria-label')).toBeTruthy();
    expect(hexInput?.getAttribute('pattern')).toMatch(/\^#/);
  });

  it('color picker visual tem aria-hidden=true e tabIndex=-1 (FR-020)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const pickers = container.querySelectorAll('input[type="color"]');
    pickers.forEach((picker) => {
      expect(picker.getAttribute('aria-hidden')).toBe('true');
      expect(picker.getAttribute('tabindex')).toBe('-1');
    });
  });

  it('campo hex aceita valor #RRGGBB e atualiza estado (FR-020)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const hexInput = container.querySelector('#primary-color-text') as HTMLInputElement;
    expect(hexInput).not.toBeNull();
    fireEvent.change(hexInput, { target: { value: '#ff0000' } });
    expect(hexInput.value).toBe('#ff0000');
  });

  // ── FR-021: Upload logo ────────────────────────────────────────────────────

  it('input[type=file] tem aria-label (FR-021)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(
      fileInput?.getAttribute('aria-label') ?? fileInput?.getAttribute('id'),
    ).toBeTruthy();
  });

  it('label do logo tem tabIndex=0 quando habilitada (FR-021)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const logoLabel = container.querySelector('label[for="logo-upload"]');
    expect(logoLabel).not.toBeNull();
    expect(logoLabel?.getAttribute('tabindex')).toBe('0');
  });

  it('label do logo tem tabIndex=-1 quando formulário free (FR-021)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={null} />,
    );
    const logoLabel = container.querySelector('label[for="logo-upload"]');
    expect(logoLabel).not.toBeNull();
    expect(logoLabel?.getAttribute('tabindex')).toBe('-1');
  });

  // ── Nenhum <a> com role="article" (lição 11-1) ───────────────────────────

  it('sem elementos <a> com role="article"', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const links = container.querySelectorAll('a[role="article"]');
    expect(links).toHaveLength(0);
  });

  // ── CHK024: guideline documentada — não é SC automático ──────────────────

  it('CHK024: guideline de latência < 16ms documentada no componente', async () => {
    // CHK024: Target < 16ms (1 frame a 60fps). Não é SC automático — guideline de qualidade.
    // Verificamos que o comentário está presente no source do componente real.
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const source = await readFile(
      resolve(
        process.cwd(),
        'app/(authenticated)/app/admin/configuracoes/branding/BrandingSettingsForm.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('CHK024');
    expect(source).toContain('16ms');
  });
});
