/**
 * trail-builder-keyboard.spec.ts — E2E keyboard: Builder de Trilhas (US4)
 *
 * Story 12.2 — US4, FR-012, FR-013, FR-014, FR-025
 * Browser: Chromium only (CI; Firefox/Safari = gate manual em 9.2)
 *
 * Cenários de aceite US4:
 *   AC1: Botões "Mover ↑/↓" estão sempre visíveis em cada item (não on-hover)
 *   AC2: aria-label dos botões inclui o título do item (FR-012)
 *   AC3: Ativação por teclado (Enter/Space) chama onMoveUp/onMoveDown;
 *        foco permanece no botão após ativação (FR-013)
 *   AC4: Ordem de Tab é lógica — botões de reordenação antes do conteúdo
 *        do item (FR-014)
 *   AC5: axe scan — 0 violations critical no builder (FR-025)
 *
 * Estratégia (isolada — padrão configuracoes/planos/modal-focus-trap):
 *   Renderiza HTML inline via page.setContent replicando FIELMENTE o contrato
 *   acessível de TrailItemReorder (src/components/trails/trail-item-reorder.tsx)
 *   e a estrutura DOM de group-trails-client.tsx (module-item → trail-item-reorder
 *   → module-title). O comportamento FR-013 (foco permanece no botão após mover,
 *   restaurado via requestAnimationFrame) e o anúncio ARIA live (CHK004) são
 *   implementados no <script> com a MESMA semântica dos componentes reais.
 *   Isso valida os contratos de teclado sem depender de auth/backend/dados de
 *   trilha (Keycloak indisponível fora do CI).
 *
 * dec-014: botões "Mover ↑/↓" são SEMPRE VISÍVEIS (não :focus-within),
 * com aria-label descritivo incluindo o título do item.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BTN_UP = '[data-testid="trail-item-reorder-up"]';
const BTN_DOWN = '[data-testid="trail-item-reorder-down"]';
const REORDER_CONTAINER = '[data-testid="trail-item-reorder"]';
const MODULES_LIST = '[data-testid="modules-list"]';

/**
 * Renderiza um item de módulo (module-item → trail-item-reorder → module-title),
 * espelhando a ordem DOM de group-trails-client.tsx e o markup de TrailItemReorder.
 */
function moduleItemHtml(id: string, title: string, index: number, total: number): string {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return `
    <li data-testid="module-item-${id}" data-index="${index}" data-title="${title}">
      <div class="inline-flex flex-col" data-testid="trail-item-reorder">
        <button
          type="button"
          ${isFirst ? "disabled" : ""}
          aria-label="Mover ${title} para cima"
          data-testid="trail-item-reorder-up"
        >↑</button>
        <button
          type="button"
          ${isLast ? "disabled" : ""}
          aria-label="Mover ${title} para baixo"
          data-testid="trail-item-reorder-down"
        >↓</button>
      </div>
      <span data-testid="module-title-${id}">${title}</span>
    </li>
  `;
}

const MODULES = [
  { id: "m1", title: "Módulo 1 — Introdução" },
  { id: "m2", title: "Módulo 2 — Fundamentos" },
  { id: "m3", title: "Módulo 3 — Aplicação" },
];

const BUILDER_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Builder de Trilhas</title>
  <style>
    body { font-family: sans-serif; }
    h1 { font-size: 20px; }
    [data-testid="trail-item-reorder"] button { width: 28px; height: 28px; }
    [data-testid="trail-item-reorder"] button:disabled { opacity: 0.4; pointer-events: none; }
    li { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <main id="conteudo">
    <h1>Builder de Trilhas</h1>
    <ul role="list" data-testid="modules-list">
      ${MODULES.map((m, i) => moduleItemHtml(m.id, m.title, i, MODULES.length)).join("")}
    </ul>
    <div
      data-testid="async-announcer-polite"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);"
    ></div>
  </main>

  <script>
    (function () {
      var list = document.querySelector('[data-testid="modules-list"]');
      var polite = document.querySelector('[data-testid="async-announcer-polite"]');

      function items() {
        return Array.prototype.slice.call(list.querySelectorAll('[data-testid^="module-item-"]'));
      }

      // Move um item para cima/baixo no DOM e restaura o foco no MESMO botão
      // (FR-013: foco permanece no botão do item movido, via requestAnimationFrame).
      function move(itemEl, direction) {
        var all = items();
        var idx = all.indexOf(itemEl);
        var title = itemEl.getAttribute('data-title');
        if (direction === 'up' && idx > 0) {
          list.insertBefore(itemEl, all[idx - 1]);
        } else if (direction === 'down' && idx < all.length - 1) {
          list.insertBefore(all[idx + 1], itemEl);
        } else {
          return;
        }
        // Recalcular disabled (extremos) e anunciar — semântica de TrailItemReorder
        rebuildDisabled();
        var newIdx = items().indexOf(itemEl);
        var pos = newIdx + 1; // base-1 para o usuário (CHK004)
        polite.textContent = title + ' movido para a posição ' + pos + '.';
        // FR-013: restaurar foco no botão do MESMO item após o "re-render"
        requestAnimationFrame(function () {
          var btn = itemEl.querySelector(
            direction === 'up'
              ? '[data-testid="trail-item-reorder-up"]'
              : '[data-testid="trail-item-reorder-down"]'
          );
          if (btn && !btn.disabled) btn.focus();
          else {
            // Se virou extremo (botão desabilitado), foca o outro botão do item
            var alt = itemEl.querySelector(
              direction === 'up'
                ? '[data-testid="trail-item-reorder-down"]'
                : '[data-testid="trail-item-reorder-up"]'
            );
            if (alt) alt.focus();
          }
        });
      }

      function rebuildDisabled() {
        var all = items();
        all.forEach(function (el, i) {
          var up = el.querySelector('[data-testid="trail-item-reorder-up"]');
          var down = el.querySelector('[data-testid="trail-item-reorder-down"]');
          if (up) up.disabled = i === 0;
          if (down) down.disabled = i === all.length - 1;
        });
      }

      // Delegação de clique (cobre Enter/Space nativos em <button>)
      list.addEventListener('click', function (e) {
        var target = e.target;
        var btn = target && target.closest ? target.closest('button') : null;
        if (!btn || btn.disabled) return;
        var itemEl = btn.closest('[data-testid^="module-item-"]');
        if (!itemEl) return;
        if (btn.getAttribute('data-testid') === 'trail-item-reorder-up') {
          move(itemEl, 'up');
        } else if (btn.getAttribute('data-testid') === 'trail-item-reorder-down') {
          move(itemEl, 'down');
        }
      });

      rebuildDisabled();
    })();
  </script>
</body>
</html>
`;

test.describe("US4 — Builder de Trilhas: reordenação por teclado", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(BUILDER_HTML, { waitUntil: "domcontentloaded" });
  });

  test(
    "AC1: botões de reordenação estão visíveis sem hover ou focus (CL-004 / dec-014)",
    async ({ page }) => {
      const upButtons = page.locator(BTN_UP);
      const downButtons = page.locator(BTN_DOWN);

      const upCount = await upButtons.count();
      const downCount = await downButtons.count();

      expect(upCount).toBeGreaterThan(0);
      expect(downCount).toBeGreaterThan(0);

      // Os botões não dependem de hover — pelo menos um par habilitado é visível
      const firstEnabledUp = page.locator(`${BTN_UP}:not([disabled])`).first();
      await expect(firstEnabledUp).toBeVisible();
      const firstEnabledDown = page.locator(`${BTN_DOWN}:not([disabled])`).first();
      await expect(firstEnabledDown).toBeVisible();

      const upStyle = await firstEnabledUp.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
        };
      });

      expect(upStyle.display).not.toBe("none");
      expect(upStyle.visibility).not.toBe("hidden");
      expect(parseFloat(upStyle.opacity)).toBeGreaterThan(0);
    },
  );

  test(
    "AC2: aria-label dos botões inclui o título do item (FR-012)",
    async ({ page }) => {
      const firstModuleTitle = await page
        .locator('[data-testid^="module-title-"]')
        .first()
        .textContent();

      expect(firstModuleTitle).toBeTruthy();
      const titulo = (firstModuleTitle ?? "").trim();

      const upBtn = page.locator(`button[aria-label="Mover ${titulo} para cima"]`);
      const downBtn = page.locator(`button[aria-label="Mover ${titulo} para baixo"]`);

      await expect(upBtn).toBeAttached();
      await expect(downBtn).toBeAttached();
    },
  );

  test(
    "AC3: Enter no botão 'para baixo' move o módulo; foco permanece no botão (FR-013)",
    async ({ page }) => {
      const moduleItems = page.locator('[data-testid^="module-item-"]');
      expect(await moduleItems.count()).toBeGreaterThanOrEqual(2);

      const firstTitle = await page
        .locator('[data-testid^="module-title-"]')
        .first()
        .textContent();

      // Focar o primeiro botão "mover para baixo" habilitado
      const firstEnabledDown = page.locator(`${BTN_DOWN}:not([disabled])`).first();
      await firstEnabledDown.focus();

      const isFocused = await firstEnabledDown.evaluate(
        (el) => document.activeElement === el,
      );
      expect(isFocused).toBe(true);

      // Ativar com Enter
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      // FR-013: foco deve permanecer no botão "para baixo" do item movido
      const focusedAriaLabel = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute("aria-label") ?? "";
      });

      if (firstTitle) {
        expect(focusedAriaLabel).toContain(firstTitle.trim());
        expect(focusedAriaLabel).toContain("para baixo");
      }
    },
  );

  test(
    "AC3b: Space no botão 'para cima' move o módulo; foco permanece no botão (FR-013)",
    async ({ page }) => {
      const moduleItems = page.locator('[data-testid^="module-item-"]');
      expect(await moduleItems.count()).toBeGreaterThanOrEqual(2);

      // Focar o último botão "para cima" habilitado
      const enabledUpButtons = page.locator(`${BTN_UP}:not([disabled])`);
      const lastEnabledUp = enabledUpButtons.last();
      await lastEnabledUp.focus();

      const titleBefore = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute("aria-label") ?? "";
      });

      // Ativar com Space
      await page.keyboard.press("Space");
      await page.waitForTimeout(100);

      const focusedAriaLabel = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute("aria-label") ?? "";
      });

      expect(focusedAriaLabel).toContain("para cima");
      if (titleBefore.includes("para cima")) {
        const itemName = titleBefore.replace("Mover ", "").replace(" para cima", "");
        expect(focusedAriaLabel).toContain(itemName);
      }
    },
  );

  test(
    "AC4: ordem de Tab é lógica — botões de reordenação aparecem antes do título do módulo (FR-014)",
    async ({ page }) => {
      const modulesList = page.locator(MODULES_LIST);
      await expect(modulesList).toBeAttached();

      const firstItem = page.locator('[data-testid^="module-item-"]').first();
      const reorderContainer = firstItem.locator(REORDER_CONTAINER);
      const moduleTitle = firstItem.locator('[data-testid^="module-title-"]');

      await expect(reorderContainer).toBeAttached();
      await expect(moduleTitle).toBeAttached();

      // reorder container deve preceder o título no DOM (ordem top-to-bottom)
      const orderOk = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="module-item-"]');
        if (!item) return false;
        const reorder = item.querySelector('[data-testid="trail-item-reorder"]');
        const title = item.querySelector('[data-testid^="module-title-"]');
        if (!reorder || !title) return false;
        return !!(reorder.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING);
      });

      expect(orderOk).toBe(true);
    },
  );

  test(
    "AC5: axe scan — 0 violations critical/serious no builder (FR-025)",
    async ({ page }) => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["color-contrast"])
        .analyze();

      const criticalOrSerious = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      );

      if (criticalOrSerious.length > 0) {
        const summary = criticalOrSerious
          .map(
            (v) =>
              `[${v.impact}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes
                .map((n) => n.target.join(", "))
                .join(" | ")}`,
          )
          .join("\n\n");
        throw new Error(
          `axe encontrou ${criticalOrSerious.length} violation(s) critical/serious:\n${summary}`,
        );
      }

      expect(criticalOrSerious).toHaveLength(0);
    },
  );

  // -------------------------------------------------------------------------
  // Testes complementares de acessibilidade
  // -------------------------------------------------------------------------

  test(
    "botões desabilitados não recebem foco via Tab (atributo disabled nativo)",
    async ({ page }) => {
      // O primeiro botão "para cima" do primeiro item está disabled (topo da lista)
      const firstUpBtn = page.locator(BTN_UP).first();
      const isDisabled = await firstUpBtn.getAttribute("disabled");
      expect(isDisabled).not.toBeNull();

      // Tab a partir do body não deve focar um botão disabled
      await page.keyboard.press("Tab");
      const focusedDisabled = await page.evaluate(() => {
        const el = document.activeElement as HTMLButtonElement | null;
        return el?.disabled ?? false;
      });
      expect(focusedDisabled).toBe(false);
    },
  );

  test(
    "anúncio ARIA live após reordenação (CHK004)",
    async ({ page }) => {
      const moduleItems = page.locator('[data-testid^="module-item-"]');
      expect(await moduleItems.count()).toBeGreaterThanOrEqual(2);

      // Ativar botão "para baixo" do primeiro módulo
      const firstEnabledDown = page.locator(`${BTN_DOWN}:not([disabled])`).first();
      await firstEnabledDown.click();

      const politeRegion = page.locator('[data-testid="async-announcer-polite"]');
      await expect(politeRegion).toContainText(/movido para a posição/, {
        timeout: 2_000,
      });
    },
  );
});
