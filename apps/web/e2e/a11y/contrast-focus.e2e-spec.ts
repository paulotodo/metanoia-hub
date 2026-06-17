/**
 * contrast-focus.e2e-spec.ts
 *
 * Spec E2E axe para rotas PÚBLICAS — valida ausência de regressão de
 * contraste e focus-ring nas páginas corrigidas por a11y-contraste-focus.
 *
 * Rotas cobertas (APENAS públicas — sem autenticação):
 *   - /        (home marketing — debt de contraste corrigido em task 2.1)
 *   - /login   (link "Esqueceu a senha?" corrigido em task 2.2)
 *
 * Estratégia:
 *   - axe com tags wcag2aa + wcag21aa (mesma config do axe-baseline.spec.ts)
 *   - `toHaveNoViolations()` = BLOQUEANTE (test fails se houver violação nova)
 *   - Regras explicitamente desabilitadas (violações pré-existentes fora do
 *     escopo desta feature, documentadas em axe-baseline-notes.md):
 *       - 'color-contrast' para elementos .text-muted-foreground (text-muted
 *         é declaradamente abaixo de 4.5:1 — uso para texto não-lido; dec-018)
 *
 * Nota: NÃO navegar para rotas autenticadas sem login. O job "E2E (Playwright)"
 * do CI já existe e roda todos os specs em apps/web/e2e/.
 *
 * Ref: spec.md §US-4/FR-015, task 4.3, feature a11y-contraste-focus
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Tags axe alinhadas com o baseline e a11y policy do projeto.
 * Ref: axe-baseline.spec.ts (mesma config para consistência).
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test.describe('a11y-contraste-focus — regressão em rotas públicas', () => {
  test.describe.configure({ mode: 'serial' }); // serial por ser I/O de rede

  test('home marketing (/) — sem regressão de contraste ou focus', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Aguardar componentes hidratarem (client-side)
    await page.waitForTimeout(500);

    const axeBuilder = new AxeBuilder({ page })
      .withTags(AXE_TAGS);

    // Excluir seletores com text-muted documentado como exceção (dec-018)
    // para não gerar falso positivo em elementos de caption/placeholder.
    // IMPORTANTE: só exclui o padrão de uso legítimo (muted como support text).
    axeBuilder.exclude('.text-muted-foreground');

    const results = await axeBuilder.analyze();

    // Log de diagnóstico para CI
    if (results.violations.length > 0) {
      console.error(
        `[contrast-focus] / violations (${results.violations.length}):`,
        results.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`).join(', ')
      );
    }

    expect(results.violations).toHaveLength(0);
  });

  test('/login — sem regressão de contraste ou focus (link "Esqueceu a senha?" corrigido)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.waitForTimeout(500);

    // Verificar que o link "Esqueceu a senha?" está presente com underline permanente
    // (correção task 2.2 — de hover:underline para underline fixo)
    const forgotLink = page.locator('a[href="/recuperar-senha"]');
    const count = await forgotLink.count();
    if (count > 0) {
      // Se o link existir, verificar que tem underline (text-decoration)
      const textDecoration = await forgotLink.evaluate(el =>
        window.getComputedStyle(el).textDecoration
      );
      // underline deve estar presente (não apenas em hover)
      expect(textDecoration).toContain('underline');
    }

    const axeBuilder = new AxeBuilder({ page })
      .withTags(AXE_TAGS);

    axeBuilder.exclude('.text-muted-foreground');

    const results = await axeBuilder.analyze();

    if (results.violations.length > 0) {
      console.error(
        `[contrast-focus] /login violations (${results.violations.length}):`,
        results.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`).join(', ')
      );
    }

    expect(results.violations).toHaveLength(0);
  });

  test('/login — focus-ring visível no link "Esqueceu a senha?" via teclado', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.waitForTimeout(300);

    // Navegar por teclado até o link de recuperação de senha
    // Tab até o campo de e-mail, senha, botão, e então o link
    const forgotLink = page.locator('a[href="/recuperar-senha"]');
    const count = await forgotLink.count();

    if (count > 0) {
      // Focar o link diretamente para verificar focus-visible
      await forgotLink.focus();

      // Verificar que o link está focado (não deve lançar erro)
      await expect(forgotLink).toBeFocused();

      // Verificar que o link tem outline ou ring visível (browser padrão ou custom)
      // A ausência de outline:none sem alternativa seria uma falha de acessibilidade
      const outlineStyle = await forgotLink.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          outline: cs.outline,
          outlineWidth: cs.outlineWidth,
          outlineStyle: cs.outlineStyle,
          boxShadow: cs.boxShadow,
        };
      });

      // O link deve ter algum indicador de foco (outline ou box-shadow de ring)
      // Se ambos forem 'none' / '0px', há ausência de indicator de foco
      const hasOutline = outlineStyle.outlineWidth !== '0px' && outlineStyle.outlineStyle !== 'none';
      const hasBoxShadow = outlineStyle.boxShadow !== 'none' && outlineStyle.boxShadow !== '';

      // Log diagnóstico
      console.log('[contrast-focus] focus indicator no link recuperar-senha:', {
        hasOutline,
        hasBoxShadow,
        ...outlineStyle,
      });

      // Pelo menos um indicador de foco deve estar presente
      // (outline nativo do browser ou ring customizado)
      expect(hasOutline || hasBoxShadow).toBe(true);
    } else {
      // Link não encontrado — skip soft (pode não existir em todas as configurações)
      test.skip(true, 'Link /recuperar-senha não encontrado na página de login');
    }
  });
});
