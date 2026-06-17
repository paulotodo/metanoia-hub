/**
 * touch-targets.e2e-spec.ts
 *
 * Spec E2E para validação de touch targets móveis (FR-1 / US-1).
 * Feature: a11y-touch-motion (Story 12.4)
 *
 * CRÍTICO (CHK033/dec-019/dec-023 — CI-RISK):
 *   - Projeto: mobile-a11y (Chromium com devices['Pixel 5'] ou viewport+hasTouch)
 *   - NUNCA iPhone/WebKit — CI é Chromium-only.
 *
 * Cenários:
 *   SC-1.1 — Todos os controles interativos em rotas públicas: getBoundingClientRect
 *             width ≥ 44 && height ≥ 44 no viewport mobile.
 *   SC-1.2 — Espaçamento entre bottom-tabs adjacentes ≥ 8px.
 *   SC-2.2 — Estado :active visualmente distinto (opacity muda durante mousedown).
 *
 * Rotas: APENAS públicas — sem autenticação necessária.
 *
 * Ref: spec.md §US-1/FR-1, plan.md §A.5, dec-008 (touch híbrido 44/24),
 *      dec-023 (CHK033 Chromium-only), tasks.md §T.2
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Tamanho mínimo de touch target (WCAG 2.5.5 / NFR-A2) */
const MIN_TOUCH_SIZE_PX = 44;

/** Espaçamento mínimo entre controles adjacentes (FR-1.3 / dec-008) */
const MIN_SPACING_PX = 8;

/**
 * Seletores de elementos interativos que devem respeitar min 44×44px.
 * Nota: elementos <a> de navegação desktop (gap-6, items-center) podem
 * ter altura < 44px em layout não-mobile — testar SOMENTE no projeto mobile.
 */
const INTERACTIVE_SELECTORS = [
  'button:not([disabled]):not([aria-hidden="true"])',
  'input:not([type="hidden"]):not([disabled])',
  '[role="tab"]:not([disabled])',
  '[role="menuitem"]:not([disabled])',
  '[role="radio"]:not([disabled])',
].join(', ');

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test.describe('a11y-touch-motion — touch targets (mobile Chromium)', () => {
  test.describe.configure({ mode: 'serial' });

  // -------------------------------------------------------------------------
  // SC-1.1: touch targets ≥ 44×44px em rotas públicas
  // -------------------------------------------------------------------------
  test('SC-1.1 — controles interativos públicos: getBoundingClientRect ≥ 44×44px', async ({
    page,
  }, testInfo) => {
    // WCAG 2.5.5 (44px) aplica-se a viewport MOBILE (< md). Em desktop (>= md) o
    // mínimo é 24px com espaçamento (WCAG 2.5.8 AA / FR-1.4), e os primitivos
    // usam md:h-10 (40px) por decisão de design. Mede APENAS em viewport mobile.
    const vp = page.viewportSize();
    test.skip(
      !vp || vp.width >= 768,
      `Viewport desktop (>= 768px) — touch target de 44px não se aplica (WCAG 2.5.8 AA / FR-1.4). Projeto: ${testInfo.project.name}`,
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500); // aguardar hidratação

    const results = await page.evaluate(
      ({ selectors, minSize }: { selectors: string; minSize: number }) => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>(selectors));
        const failures: Array<{ tag: string; text: string; w: number; h: number }> = [];

        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          // Ignorar elementos fora do viewport (display:none, visibility:hidden)
          if (rect.width === 0 && rect.height === 0) continue;
          // Ignorar elementos ocultos
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          if (rect.width < minSize || rect.height < minSize) {
            failures.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 50),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            });
          }
        }
        return failures;
      },
      { selectors: INTERACTIVE_SELECTORS, minSize: MIN_TOUCH_SIZE_PX },
    );

    if (results.length > 0) {
      const msg = results
        .map((r) => `  <${r.tag}> "${r.text}" — ${r.w}×${r.h}px`)
        .join('\n');
      // Falha suave com lista detalhada para diagnóstico
      expect.soft(
        results.length,
        `${results.length} controle(s) abaixo de ${MIN_TOUCH_SIZE_PX}px:\n${msg}`,
      ).toBe(0);
    } else {
      // Todos os controles passaram
      expect(results.length).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // SC-1.1b: verificar também /login (rota pública com inputs)
  // -------------------------------------------------------------------------
  test('SC-1.1b — /login: controles interativos ≥ 44×44px no mobile', async ({
    page,
  }, testInfo) => {
    // Ver SC-1.1: 44px é critério MOBILE; desktop usa 24px+espaçamento (FR-1.4).
    const vp = page.viewportSize();
    test.skip(
      !vp || vp.width >= 768,
      `Viewport desktop (>= 768px) — touch target de 44px não se aplica (WCAG 2.5.8 AA / FR-1.4). Projeto: ${testInfo.project.name}`,
    );
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const results = await page.evaluate(
      ({ selectors, minSize }: { selectors: string; minSize: number }) => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>(selectors));
        const failures: Array<{ tag: string; label: string; w: number; h: number }> = [];

        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          if (rect.width < minSize || rect.height < minSize) {
            failures.push({
              tag: el.tagName.toLowerCase(),
              label: (
                el.getAttribute('aria-label') ??
                el.getAttribute('placeholder') ??
                el.textContent ??
                ''
              )
                .trim()
                .slice(0, 50),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            });
          }
        }
        return failures;
      },
      { selectors: INTERACTIVE_SELECTORS, minSize: MIN_TOUCH_SIZE_PX },
    );

    if (results.length > 0) {
      const msg = results
        .map((r) => `  <${r.tag}> "${r.label}" — ${r.w}×${r.h}px`)
        .join('\n');
      expect.soft(
        results.length,
        `/login: ${results.length} controle(s) abaixo de ${MIN_TOUCH_SIZE_PX}px:\n${msg}`,
      ).toBe(0);
    } else {
      expect(results.length).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // SC-1.2: espaçamento entre bottom-tabs adjacentes ≥ 8px
  // Bottom-tabs são renderizados no layout autenticado; em rotas públicas
  // podem não estar presentes — cenário marcado como condicional.
  // -------------------------------------------------------------------------
  test('SC-1.2 — bottom-tabs: espaçamento entre adjacentes ≥ 8px', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Bottom tabs identificados por role="tablist" ou data-testid*="bottom-tabs"
    const bottomNav = page.locator(
      '[data-testid*="bottom-tabs"], [role="tablist"][aria-label*="Navegação"], nav[aria-label*="bottom"]',
    );
    const navCount = await bottomNav.count();

    if (navCount === 0) {
      test.info().annotations.push({
        type: 'note',
        description:
          'Bottom-tabs não encontrados em rota pública — componente só renderiza em layout autenticado. Cenário N/A aqui.',
      });
      // Pass condicional — não falhar por ausência do componente
      return;
    }

    const spacingResults = await page.evaluate(
      ({ navSelector, minSpacing }: { navSelector: string; minSpacing: number }) => {
        const nav = document.querySelector<HTMLElement>(navSelector);
        if (!nav) return { found: false, failures: [] };

        const items = Array.from(nav.querySelectorAll<HTMLElement>('[role="tab"], a, button'));
        if (items.length < 2) return { found: true, failures: [] };

        const failures: Array<{ i: number; j: number; spacing: number }> = [];

        for (let i = 0; i < items.length - 1; i++) {
          const rectA = items[i].getBoundingClientRect();
          const rectB = items[i + 1].getBoundingClientRect();

          // Espaçamento horizontal entre borda direita de A e esquerda de B
          const spacing = rectB.left - rectA.right;

          if (spacing < minSpacing) {
            failures.push({ i, j: i + 1, spacing: Math.round(spacing) });
          }
        }

        return { found: true, failures };
      },
      {
        navSelector:
          '[data-testid*="bottom-tabs"], [role="tablist"][aria-label*="Navegação"], nav[aria-label*="bottom"]',
        minSpacing: MIN_SPACING_PX,
      },
    );

    if (!spacingResults.found) {
      test.info().annotations.push({ type: 'note', description: 'Bottom nav não encontrado via evaluate.' });
      return;
    }

    if (spacingResults.failures.length > 0) {
      const msg = spacingResults.failures
        .map((f) => `  tabs[${f.i}]→tabs[${f.j}]: ${f.spacing}px (mín ${MIN_SPACING_PX}px)`)
        .join('\n');
      expect.soft(
        spacingResults.failures.length,
        `Bottom-tabs com espaçamento < ${MIN_SPACING_PX}px:\n${msg}`,
      ).toBe(0);
    } else {
      expect(spacingResults.failures.length).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // SC-2.2 (CHK035): estado :active visualmente distinto
  // Verifica que opacity/transform muda ao pressionar um botão interativo.
  // Ref: B.2, FR-2.4, dec-008
  // -------------------------------------------------------------------------
  test('SC-2.2 — :active feedback: opacity/transform muda durante mousedown', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Buscar primeiro button visível na página (ex: CTA principal)
    const btnCount = await page.locator('button:not([disabled])').count();

    if (btnCount === 0) {
      // Tentar /login
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
    }

    const targetBtn = page.locator('button:not([disabled])').first();
    const isVisible = await targetBtn.isVisible().catch(() => false);

    if (!isVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Nenhum button visível encontrado em rota pública.',
      });
      return;
    }

    // Capturar opacity ANTES do mousedown
    const opacityBefore = await targetBtn.evaluate((el) =>
      parseFloat(getComputedStyle(el).opacity),
    );

    // Simular mousedown (sem soltar) e capturar opacity
    await page.mouse.move(
      ...(await targetBtn.boundingBox().then((b) => [
        b ? b.x + b.width / 2 : 0,
        b ? b.y + b.height / 2 : 0,
      ] as [number, number])),
    );
    await page.mouse.down();

    const opacityDuring = await targetBtn.evaluate((el) =>
      parseFloat(getComputedStyle(el).opacity),
    );

    await page.mouse.up();

    // O estado :active DEVE produzir opacity diferente (active:opacity-80 = 0.8)
    // Tolerância: qualquer mudança de opacity ≥ 0.05 (5%) é suficiente
    const delta = Math.abs(opacityBefore - opacityDuring);

    // Soft assert — alguns botões podem não ter :active definido ainda
    // (ex: o Button primitivo de @metanoia/ui que já tem active: nativa)
    expect.soft(
      delta,
      `Botão "${((await targetBtn.textContent()) ?? '').trim()}" deve ter opacity diferente durante :active (before=${opacityBefore}, during=${opacityDuring})`,
    ).toBeGreaterThanOrEqual(0.05);
  });
});
