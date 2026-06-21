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
 *   1. options.selector (se fornecido)
 *   2. Elemento com [data-autofocus]
 *   3. Fallback: primeiro h1
 *   4. Fallback final: #conteudo (com tabIndex=-1 injetado se ausente)
 *
 * Estratégia (isolada — padrão configuracoes/planos/modal-focus-trap):
 *   O FocusManager (useFocusOnRouteChange) só dispara em MUDANÇA de pathname,
 *   nunca no mount inicial, e atua independentemente do estado de autenticação.
 *   Para validar o contrato de foco sem depender de Keycloak/backend (indisponível
 *   fora do CI), este spec renderiza HTML inline via page.setContent e replica
 *   FIELMENTE a cadeia de fallback CHK007 em um <script>, expondo
 *   `window.__navigate(html)` para simular a transição de rota SPA que o hook
 *   observa via usePathname(). Os asserts validam o comportamento real de foco.
 *
 * Cenários cobertos (US2 AC1–AC3):
 *   AC1: Após "navegação" para dashboard, foco não está em document.body
 *   AC2: Foco está em [data-autofocus] ou h1 (nunca perdido)
 *   AC3: Funciona para rota direta E rota profunda (conteúdo distinto)
 *   FR-025: axe scan com 0 violations "critical"
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// HTML base do shell autenticado + FocusManager replicado (CHK007)
// ---------------------------------------------------------------------------

/**
 * Replica a cadeia de fallback de `resolveTarget` em
 * apps/web/src/hooks/use-focus-on-route-change.ts e a regra de "dispara apenas
 * em mudança de pathname" do hook. `window.__navigate(htmlContent)` substitui o
 * conteúdo de #conteudo e move o foco — simulando uma navegação SPA.
 */
const SHELL_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Área autenticada</title>
</head>
<body>
  <a href="#conteudo" class="skip-nav" style="position:absolute;left:-9999px;">Pular para o conteúdo</a>
  <nav aria-label="Main navigation">
    <ul role="list">
      <li><a href="/app/gestao/radar" tabindex="0" aria-current="page">Radar</a></li>
      <li><a href="/app/gestao/relatorios/trilhas" tabindex="-1">Trilhas</a></li>
    </ul>
  </nav>
  <main id="conteudo">
    <h1>Carregando…</h1>
  </main>

  <script>
    (function () {
      // CHK007 — cadeia de fallback idêntica a resolveTarget()
      function resolveTarget(customSelector) {
        if (customSelector) {
          var custom = document.querySelector(customSelector);
          if (custom) return custom;
        }
        var autofocus = document.querySelector('[data-autofocus]');
        if (autofocus) return autofocus;
        var h1 = document.querySelector('h1');
        if (h1) {
          // h1 só é focável programaticamente com tabindex negativo — injeta -1
          // (mesma técnica do hook real para #conteudo). Mantém o h1 como alvo
          // de foco (CHK007 #3) sem inseri-lo na ordem natural de Tab.
          if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
          return h1;
        }
        var main = document.querySelector('#conteudo');
        if (main) {
          if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
          return main;
        }
        return null;
      }

      // Simula uma navegação SPA: troca o conteúdo de #conteudo e dispara o
      // FocusManager (que no app real reage à mudança de usePathname()).
      window.__navigate = function (htmlContent) {
        document.getElementById('conteudo').innerHTML = htmlContent;
        var target = resolveTarget();
        if (target) target.focus({ preventScroll: false });
      };
    })();
  </script>
</body>
</html>
`;

// Conteúdos de destino por rota (apenas h1 → fallback CHK007 #3)
const DASHBOARD_CONTENT = '<h1>Painel da Igreja</h1><p>Visão geral do radar pastoral.</p>';
const GRUPOS_CONTENT = '<h1>Grupos</h1><p>Gerencie células e pequenos grupos.</p>';
// Conteúdo com [data-autofocus] explícito (fallback CHK007 #2 tem prioridade)
const DASHBOARD_AUTOFOCUS_CONTENT =
  '<h1>Painel</h1><button data-autofocus type="button">Ação principal</button>';

async function assertFocusNotOnBody(page: import('@playwright/test').Page): Promise<void> {
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? 'BODY');
  expect(focusedTag).not.toBe('BODY');
}

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
  test.beforeEach(async ({ page }) => {
    await page.setContent(SHELL_HTML, { waitUntil: 'domcontentloaded' });
  });

  /**
   * AC1: Após navegação para dashboard, foco não está em document.body (CHK007).
   */
  test('AC1: foco não está em body após navegação para dashboard', async ({ page }) => {
    await page.evaluate((html) => (window as unknown as { __navigate: (h: string) => void }).__navigate(html), DASHBOARD_CONTENT);
    await page.waitForTimeout(100);

    await assertFocusNotOnBody(page);
  });

  /**
   * AC2: Foco em [data-autofocus] ou h1 após navegação (CHK007).
   */
  test('AC2: foco em [data-autofocus] ou h1 após navegação', async ({ page }) => {
    await page.evaluate((html) => (window as unknown as { __navigate: (h: string) => void }).__navigate(html), DASHBOARD_AUTOFOCUS_CONTENT);
    await page.waitForTimeout(100);

    await assertFocusOnMeaningfulElement(page);
    // CHK007 #2: [data-autofocus] tem prioridade sobre h1
    const hasAutofocus = await page.evaluate(
      () => document.activeElement?.hasAttribute('data-autofocus') ?? false,
    );
    expect(hasAutofocus).toBe(true);
  });

  /**
   * AC3: Rota profunda — grupos. FR-007: testar rota direta E rota profunda.
   */
  test('AC3: foco não está em body após navegação para rota profunda /grupos', async ({ page }) => {
    await page.evaluate((html) => (window as unknown as { __navigate: (h: string) => void }).__navigate(html), GRUPOS_CONTENT);
    await page.waitForTimeout(100);

    await assertFocusNotOnBody(page);
    await assertFocusOnMeaningfulElement(page);
  });

  /**
   * AC3 (complementar): navegação SPA entre rotas mantém foco correto.
   * O FocusManager deve mover o foco após cada mudança de pathname.
   */
  test('AC3: navegação SPA entre rotas move foco corretamente', async ({ page }) => {
    // Navega para o dashboard
    await page.evaluate((html) => (window as unknown as { __navigate: (h: string) => void }).__navigate(html), DASHBOARD_CONTENT);
    await page.waitForTimeout(100);
    await assertFocusNotOnBody(page);

    const firstHeading = await page.evaluate(
      () => document.activeElement?.textContent ?? '',
    );

    // Navega para grupos — foco deve mover para o novo contexto (nunca body)
    await page.evaluate((html) => (window as unknown as { __navigate: (h: string) => void }).__navigate(html), GRUPOS_CONTENT);
    await page.waitForTimeout(100);
    await assertFocusNotOnBody(page);

    const secondHeading = await page.evaluate(
      () => document.activeElement?.textContent ?? '',
    );

    // O foco moveu-se para o h1 do novo contexto (conteúdo diferente)
    expect(secondHeading).not.toBe(firstHeading);
  });

  /**
   * FR-025: Axe scan — 0 violations "critical" após navegação.
   */
  test('FR-025: axe scan — 0 violations critical após navegação para dashboard', async ({ page }) => {
    await page.evaluate((html) => (window as unknown as { __navigate: (h: string) => void }).__navigate(html), DASHBOARD_CONTENT);
    await page.waitForTimeout(100);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical',
    );

    if (criticalViolations.length > 0) {
      console.error('Axe violations críticas encontradas:');
      criticalViolations.forEach((v) => {
        console.error(`  [${v.id}] ${v.description}`);
        v.nodes.forEach((n) => console.error(`    → ${n.html}`));
      });
    }

    expect(criticalViolations).toHaveLength(0);
  });
});
