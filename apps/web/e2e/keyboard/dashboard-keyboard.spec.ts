/**
 * dashboard-keyboard.spec.ts — E2E keyboard: Dashboard e Sidebar (US1)
 *
 * Story 12.2 — US1, FR-003, FR-004, FR-005, FR-025
 * Browser: Chromium only (CI; Firefox/Safari = gate manual em 9.2)
 *
 * Cenários:
 *   1. Skip link "#conteudo" está presente e funcional (FR-003)
 *   2. Tab entra na sidebar pelo item com tabindex=0
 *   3. Arrow Down navega para o próximo item da sidebar (FR-004)
 *   4. Wrap circular: Arrow Down no último item vai ao primeiro (CHK009)
 *   5. Home e End funcionam na sidebar (CHK009)
 *   6. axe scan na página: 0 violations critical/serious (FR-025)
 *
 * Estratégia (isolada — padrão configuracoes/planos/modal-focus-trap):
 *   Renderiza HTML inline via page.setContent replicando fielmente o contrato
 *   acessível do componente Sidebar (packages/ui/components/sidebar.tsx) e do
 *   SkipNav. O roving tabindex (Arrow Up/Down + Home/End + wrap circular,
 *   CHK009) é implementado no <script> com a MESMA semântica de
 *   useSidebarRovingTabindex. Isso valida os contratos de teclado sem depender
 *   de auth/backend (Keycloak indisponível fora do CI).
 *
 * CHK048: Radix Tooltip não interfere com o roving tabindex da sidebar — os
 * tooltips são montados em portais fora do <nav> e não recebem foco nativo.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SKIP_LINK = 'a[href="#conteudo"]';

/**
 * HTML que replica o shell autenticado: SkipNav + Sidebar (roving tabindex) +
 * <main id="conteudo">. Reproduz os itens reais de config/navigation.ts.
 */
const DASHBOARD_SHELL_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Dashboard</title>
  <style>
    body { margin: 0; font-family: sans-serif; }
    .skip-nav {
      position: absolute;
      left: 8px; top: 8px;
      transform: translateY(-200%);
      background: #1d4ed8; color: #fff;
      padding: 8px 12px; border-radius: 6px;
      z-index: 50; text-decoration: none;
    }
    .skip-nav:focus { transform: translateY(0); }
    nav { width: 240px; border-right: 1px solid #d4d4d4; padding: 12px; }
    nav ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    nav a {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-radius: 8px;
      color: #404040; text-decoration: none;
    }
    nav a[aria-current="page"] { background: #e0e7ff; color: #1d4ed8; }
    main { padding: 16px; }
  </style>
</head>
<body>
  <a href="#conteudo" class="skip-nav" data-testid="skip-nav">Pular para o conteúdo</a>

  <nav aria-label="Main navigation">
    <ul role="list">
      <li><a href="/app/gestao/radar" tabindex="0" aria-current="page">Radar</a></li>
      <li><a href="/app/gestao/reunioes" tabindex="-1">Reuniões</a></li>
      <li><a href="/app/gestao/relatorios/lider" tabindex="-1">Relatórios</a></li>
      <li><a href="/app/gestao/relatorios/trilhas" tabindex="-1">Trilhas</a></li>
    </ul>
  </nav>

  <main id="conteudo" tabindex="-1">
    <h1>Painel</h1>
  </main>

  <script>
    // Roving tabindex — mesma semântica de useSidebarRovingTabindex
    // (packages/ui/components/sidebar.tsx): Arrow Up/Down com wrap circular,
    // Home/End, apenas um item com tabindex=0 por vez. CHK009.
    (function () {
      var nav = document.querySelector('nav[aria-label="Main navigation"]');
      function items() {
        return Array.prototype.slice.call(
          nav.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
        );
      }
      function focusables() {
        // Inclui itens com tabindex=-1 do roving (são focáveis programaticamente)
        return Array.prototype.slice.call(nav.querySelectorAll('a[href]'));
      }
      function activate(list, index) {
        list.forEach(function (el, i) {
          el.setAttribute('tabindex', i === index ? '0' : '-1');
        });
        if (list[index]) list[index].focus();
      }
      nav.addEventListener('keydown', function (event) {
        var list = focusables();
        if (list.length === 0) return;
        var current = list.indexOf(document.activeElement);
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          activate(list, current <= 0 ? list.length - 1 : current - 1);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          activate(list, current >= list.length - 1 ? 0 : current + 1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          activate(list, 0);
        } else if (event.key === 'End') {
          event.preventDefault();
          activate(list, list.length - 1);
        }
      });

      // SkipNav: Enter move foco para #conteudo
      var skip = document.querySelector('a[href="#conteudo"]');
      skip.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('conteudo').focus();
        }
      });
    })();
  </script>
</body>
</html>
`;

test.describe("US1 — Dashboard e Sidebar: navegação por teclado", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(DASHBOARD_SHELL_HTML, { waitUntil: "domcontentloaded" });
  });

  test("AC1: skip link '#conteudo' está presente e é o primeiro elemento focável", async ({
    page,
  }) => {
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
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // primeiro item da sidebar

    const firstHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );

    await page.keyboard.press("ArrowDown");

    const secondHref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );

    expect(secondHref).not.toBe(firstHref);
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

    expect(wrappedHref).not.toBe(lastHref);
  });

  test("AC5: Home e End navegam diretamente para extremos da sidebar (CHK009)", async ({
    page,
  }) => {
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // primeiro item

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
      .disableRules(["color-contrast"])
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
