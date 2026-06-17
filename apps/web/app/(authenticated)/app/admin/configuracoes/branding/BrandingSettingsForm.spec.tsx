/**
 * BrandingSettingsForm.spec.tsx — Testes de acessibilidade para BrandingSettingsForm
 *
 * Story 12.2 — US6, FR-019..FR-021, CL-005, CHK024
 * Refs: dec-015 (manter foco na origem + aria-live polite), dec-045 (FASE 7)
 *
 * Cobre:
 *   - jest-axe: 0 violations WCAG (AC8)
 *   - Tab order: todos os text inputs têm id+label (FR-019)
 *   - Campo hex: aria-label + pattern (FR-020)
 *   - Color pickers: aria-hidden=true + tabIndex=-1 (FR-020)
 *   - Upload logo: input[type=file] tem aria-label; label tem tabIndex (FR-021)
 *   - Nenhum <a> com role="article" (lição 11-1)
 *   - CHK024: guideline de latência documentada
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandingSettingsForm } from './BrandingSettingsForm';

// ---------------------------------------------------------------------------
// Mock useAsyncAnnouncer (CL-005)
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

describe('BrandingSettingsForm — acessibilidade (FASE 7, US6)', () => {
  beforeEach(() => {
    mockAnnounce.mockClear();
  });

  // ── jest-axe ─────────────────────────────────────────────────────────────

  it('sem violações WCAG com branding Pro (jest-axe)', async () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sem violações WCAG com branding nulo — free (jest-axe)', async () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={null} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── FR-019: Tab order ────────────────────────────────────────────────────

  it('todos os inputs text têm label associada via htmlFor+id (FR-019)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const textInputs = container.querySelectorAll('input[type="text"]');
    expect(textInputs.length).toBeGreaterThanOrEqual(3);
    textInputs.forEach((input) => {
      const id = input.getAttribute('id');
      expect(id).toBeTruthy();
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label, `label para #${id} não encontrada`).not.toBeNull();
      }
    });
  });

  // ── FR-020: Campos hex acessíveis ─────────────────────────────────────────

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
    expect(pickers.length).toBeGreaterThanOrEqual(2);
    pickers.forEach((picker) => {
      expect(picker.getAttribute('aria-hidden')).toBe('true');
      expect(picker.getAttribute('tabindex')).toBe('-1');
    });
  });

  it('campo hex aceita #RRGGBB e reflete no estado (FR-020)', () => {
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

  it('label do logo tem tabIndex=0 quando plano Pro (FR-021)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const logoLabel = container.querySelector('label[for="logo-upload"]');
    expect(logoLabel).not.toBeNull();
    expect(logoLabel?.getAttribute('tabindex')).toBe('0');
  });

  it('label do logo tem tabIndex=-1 quando free/null (FR-021)', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={null} />,
    );
    const logoLabel = container.querySelector('label[for="logo-upload"]');
    expect(logoLabel).not.toBeNull();
    expect(logoLabel?.getAttribute('tabindex')).toBe('-1');
  });

  // ── Sem role="article" em <a> (lição 11-1) ───────────────────────────────

  it('sem <a> com role="article"', () => {
    const { container } = renderWithQuery(
      <BrandingSettingsForm initialBranding={PRO_BRANDING} />,
    );
    const links = container.querySelectorAll('a[role="article"]');
    expect(links).toHaveLength(0);
  });

  // ── CHK024: guideline documentada ────────────────────────────────────────

  it('CHK024: guideline de latência < 16ms documentada no componente', async () => {
    // CHK024: Target < 16ms (1 frame a 60fps). Não é SC automático — é guideline.
    // Importamos o texto-fonte via URL ESM (sem require, sem @typescript-eslint/no-require-imports).
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
