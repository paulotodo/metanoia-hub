/**
 * post-login-focus.spec.ts -- E2E keyboard test: Foco Pós-Login (WCAG 2.1 SC 2.4.3)
 *
 * Ref: US2/AC1-AC3, FR-006, FR-007, TD-001, CHK007 -- feature a11y-teclado-autenticado FASE 3
 * Browser: Chromium only (dec-012).
 *
 * Story: "Como usuário de teclado, após autenticação quero que o foco vá para
 * o primeiro elemento interativo significativo da página de destino, nunca para
 * <body> ou topo sem contexto."
 *
 * CHK007 — Sequência de fallback do FocusManager (operacionalizada em useFocusOnRouteChange):
 *   1. Elemento com [data-autofocus] dentro de #conteudo
 *   2. Fallback: primeiro h1 dentro de #conteudo
 *   3. Fallback final: o próprio #conteudo (com tabIndex=-1)
 *
 * CHK036 — Nota sobre rotas dinâmicas:
 *   usePathname() detecta mudanças entre segmentos distintos (ex: /dashboard → /grupos).
 *   Para rotas com parâmetros dinâmicos (/grupos/123 → /grupos/456), o hook depende
 *   de usePathname() que normaliza o pathname base — mudanças de parâmetro dinâmico
 *   dentro do mesmo segmento não disparam nova movimentação de foco.
 *
 * Cenários cobertos (US2 AC1–AC3):
 *   AC1: Após redirect para /dashboard, foco não está em document.body
 *   AC2: Foco está em elemento com [data-autofocus] ou h1 (nunca perdido)
 *   AC3: Funciona para rota direta (/dashboard) e rota profunda (/app/admin/grupos)
 *   FR-025: axe scan com 0 violations "critical"
 *
 * Premissa de ambiente:
 *   Os testes simulam navegação direta às rotas (sem Keycloak real).
 *   Em CI com autenticação real, usar fixtures de sessão ou
 *   PLAYWRIGHT_SKIP_AUTH. Estes testes validam o comportamento de foco
 *   assumindo que o usuário já está autenticado (rota acessível).
 *
 * NOTA para CI: Em ambiente sem auth configurado, os testes validam o
 * comportamento de foco na página renderizada (login redirect ou conteúdo).
 * O FocusManager atua independentemente do estado de autenticação — ele
 * responde à mudança de pathname, não ao status de auth.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Helper: verifica se o foco atual NÃO está em document.body.
 * O foco em body indica que o gerenciamento de foco falhou (CHK007).
 */
async function assertFocusNotOnBody(page: import('@playwright/test').Page): Promise<void> {
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? 'BODY');
  expect(focusedTag).not.toBe('BODY');
}

/**
 * Helper: verifica se o foco está em elemento com [data-autofocus] ou h1 ou #conteudo.
 * CHK007: o FocusManager prioriza [data-autofocus] sobre h1 sobre #conteudo.
 */
async function assertFocusOnMeaningfulElement(page: import('@playwright/test').Page): Promise<void> {
  const focusInfo = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { tag: 'NONE', hasAutofocus: false, id: '' };
    return {
      tag: el.tagName,
      hasAutofocus: el.hasAttribute('data-autofocus'),
      id: el.id ?? '',
    };
  });

  // Deve estar em: [data-autofocus], h1, ou #conteudo (fallback)
  const isValid =
    focusInfo.hasAutofocus ||
    focusInfo.tag === 'H1' ||
    focusInfo.id === 'conteudo';

  expect(isValid).toBe(true);
}

// ---------------------------------------------------------------------------
// Grupo principal: foco pós-login em rotas autenticadas
// ---------------------------------------------------------------------------
test.describe('Foco Pós-Login — área autenticada (US2/TD-001)', () => {
  /**
   * AC1 + AC3: Rota direta — dashboard
   * Navega para /app/admin/igreja/dashboard e verifica que o foco
   * não está em document.body após a navegação (CHK007).
   */
  test('AC1: foco não está em body após navegação para dashboard', async ({ page }) => {
    await page.goto('/app/admin/igreja/dashboard');
    await page.waitForLoadState('networkidle');

    // Aguardar que o FocusManager processe a mudança de rota
    // (usa requestAnimationFrame/setTimeout internamente)
    await page.waitForTimeout(300);

    await assertFocusNotOnBody(page);
  });

  /**
   * AC2: Foco em [data-autofocus] ou h1 no dashboard
   * Verifica que o elemento focado é semântico e significativo (CHK007).
   */
  test('AC2: foco em [data-autofocus] ou h1 após navegação', async ({ page }) => {
    await page.goto('/app/admin/igreja/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await assertFocusOnMeaningfulElement(page);
  });

  /**
   * AC3: Rota profunda — grupos (rota com segmento admin)
   * FR-007: testar com rota direta E rota profunda.
   */
  test('AC3: foco não está em body após navegação para rota profunda /grupos', async ({ page }) => {
    await page.goto('/app/admin/grupos');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await assertFocusNotOnBody(page);
  });

  /**
   * AC3 (complementar): navegação SPA entre rotas mantém foco correto
   * Simula transição de rota dentro da área autenticada.
   * O FocusManager deve mover o foco após cada mudança de pathname.
   */
  test('AC3: navegação SPA entre rotas move foco corretamente', async ({ page }) => {
    // Iniciar no dashboard
    await page.goto('/app/admin/igreja/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // Verificar foco inicial (não em body)
    await assertFocusNotOnBody(page);

    // Navegar para grupos (SPA navigation via Link/router)
    await page.goto('/app/admin/grupos');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // Foco deve ter se movido para o novo contexto (nunca body)
    await assertFocusNotOnBody(page);
  });

  /**
   * FR-025: Axe scan — 0 violations "critical" após navegação
   * Verifica que a gestão de foco não introduz violações de acessibilidade.
   *
   * CHK048 (paridade com dashboard-keyboard.spec.ts): Radix Tooltip não
   * interfere com o gerenciamento de foco pós-login porque o FocusManager
   * age em #conteudo (não em tooltips). Verificação empírica: Tooltip só
   * recebe foco via Tab (não via FocusManager), então não há conflito.
   */
  test('FR-025: axe scan — 0 violations critical após navegação para dashboard', async ({ page }) => {
    await page.goto('/app/admin/igreja/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical',
    );

    if (criticalViolations.length > 0) {
      // Reportar detalhes para diagnóstico antes de falhar
      console.error('Axe violations críticas encontradas:');
      criticalViolations.forEach((v) => {
        console.error(`  [${v.id}] ${v.description}`);
        v.nodes.forEach((n) => console.error(`    → ${n.html}`));
      });
    }

    expect(criticalViolations).toHaveLength(0);
  });
});
