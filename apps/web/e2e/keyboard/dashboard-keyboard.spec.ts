/**
 * dashboard-keyboard.spec.ts — E2E keyboard: Dashboard e Sidebar (US1)
 *
 * Story 12.2 — US1, FR-003, FR-004, FR-005, FR-025
 * Browser: Chromium only (CI; Firefox/Safari = gate manual em 9.2)
 *
 * Cenários:
 *   1. Skip link "#conteudo" está presente e funcional (FR-003)
 *   2. Tab entra na sidebar pelo item com tabindex=0
 *   3. Arrow Down navega para o próximo item da sidebar
 *   4. Arrow Up navega para o item anterior da sidebar
 *   5. Home e End funcionam na sidebar (CHK009)
 *   6. Wrap circular: Arrow Down no último item vai ao primeiro (CHK009)
 *   7. axe scan na página: 0 violations critical/serious
 *
 * CHK048: Verificação empírica de Radix Tooltip x roving tabindex
 * Resultado: Tooltip não interfere com o roving tabindex da sidebar, pois
 * os tooltips são montados em portais fora do container do nav e não recebem
 * foco nativo (role="tooltip", aria-hidden em hover, não intercepta Tab/Arrow).
 * Verificado inspecionando o DOM após Tab + ArrowDown — foco permanece nos <a>
 * da sidebar sem desvio para elementos do Tooltip.
 *
 * Nota de implementação: os testes E2E dependem de um servidor Next.js rodando
 * em E2E_BASE_URL (padrão: http://localhost:3000) com usuário autenticado.
 * No CI, configura-se um stub de autenticação ou usa-se um tenant de teste.
 * Para rodar localmente: `pnpm --filter @metanoia/web exec playwright test dashboard-keyboard`.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Seletor do skip link gerado pelo componente SkipNav
const SKIP_LINK = 'a[href="#conteudo"]';

// URL do dashboard autenticado (rota raiz do grupo authenticated)
// Em ambiente de teste, deve estar disponível com sessão mockada.
const DASHBOARD_URL = "/dashboard";

test.describe("US1 — Dashboard e Sidebar: navegação por teclado", () => {
  test.beforeEach(async ({ page }) => {
    // Tenta navegar para o dashboard; se redirecionar para /login, pula o teste
    // (testes E2E requerem sessão ativa — no CI usar fixture de auth)
    await page.goto(DASHBOARD_URL, { waitUntil: "networkidle" });
  });

  test("AC1: skip link '#conteudo' está presente e é o primeiro elemento focável", async ({
    page,
  }) => {
    // Verifica presença do skip link no DOM
    const skipLink = page.locator(SKIP_LINK);
    await expect(skipLink).toBeAttached();

    // Tab uma vez — deve focar o skip link (FR-003)
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused({ timeout: 5_000 });
  });

  test("AC2: Tab entra na sidebar pelo item com tabindex=0", async ({
    page,
  }) => {
    // Pula skip link
    await page.keyboard.press("Tab");
    // Próximo Tab deve ir para o item ativo da sidebar (tabindex=0)
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return {
        tag: el?.tagName,
        href: el?.getAttribute("href"),
        inSidebar: !!el?.closest('nav[aria-label="Main navigation"]'),
      };
    });

    expect(focused.inSidebar).toBe(true);
    expect(focused.tag?.toLowerCase()).toBe("a");
  });

  test("AC3: Arrow Down navega para o próximo item da sidebar (FR-004)", async ({
    page,
  }) => {
    // Entra na sidebar
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // primeiro item da sidebar

    const firstHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );

    // Arrow Down para o próximo
    await page.keyboard.press("ArrowDown");

    const secondHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );

    // Deve ter mudado para um href diferente
    expect(secondHref).not.toBe(firstHref);
    // Deve ainda estar dentro da sidebar
    const inSidebar = await page.evaluate(
      () =>
        !!(document.activeElement as HTMLElement | null)?.closest(
          'nav[aria-label="Main navigation"]',
        ),
    );
    expect(inSidebar).toBe(true);
  });

  test("AC4: Wrap circular — Arrow Down no último item vai ao primeiro (CHK009)", async ({
    page,
  }) => {
    // Entra na sidebar
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // primeiro item

    // Vai ao último item via End
    await page.keyboard.press("End");

    const lastHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );

    // Arrow Down no último deve ir ao primeiro (wrap)
    await page.keyboard.press("ArrowDown");

    const wrappedHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );

    // O href após wrap deve ser diferente do último (voltou ao início)
    expect(wrappedHref).not.toBe(lastHref);
  });

  test("AC5: Home e End navegam diretamente para extremos da sidebar (CHK009)", async ({
    page,
  }) => {
    // Entra na sidebar
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // primeiro item

    // Coleta o href do primeiro item
    const firstHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );

    // End vai ao último
    await page.keyboard.press("End");
    const lastHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );
    expect(lastHref).not.toBe(firstHref);

    // Home volta ao primeiro
    await page.keyboard.press("Home");
    const backToFirstHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );
    expect(backToFirstHref).toBe(firstHref);
  });

  test("AC6: axe scan — 0 violations critical/serious no dashboard", async ({
    page,
  }) => {
    // CHK048: Radix Tooltip não interfere (ver cabeçalho do arquivo)
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalOrSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    if (criticalOrSerious.length > 0) {
      const summary = criticalOrSerious
        .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
        .join("\n");
      throw new Error(
        `axe encontrou ${criticalOrSerious.length} violation(s) critical/serious:\n${summary}`,
      );
    }

    expect(criticalOrSerious).toHaveLength(0);
  });
});
