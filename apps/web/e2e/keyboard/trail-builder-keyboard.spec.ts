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
 * Nota de implementação:
 *   Os testes E2E dependem de um servidor Next.js rodando em E2E_BASE_URL
 *   (padrão: http://localhost:3000) com sessão de usuário autenticado e
 *   dados de trilha disponíveis. No CI, usar fixture de autenticação ou
 *   stub de dados.
 *
 *   URL do builder: /grupos/{groupId}/trilhas/{trailId}/builder
 *   (rota do builder de trilhas no contexto autenticado)
 *
 * dec-014: botões "Mover ↑/↓" são SEMPRE VISÍVEIS (não :focus-within),
 * com aria-label descritivo incluindo o título do item.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

/** URL do builder de trilhas — ajustar para o path real da rota */
const BUILDER_URL = process.env["E2E_TRAIL_BUILDER_URL"] ?? "/grupos/test/trilhas/test/builder";

/** Seletor dos botões "Mover para cima" */
const BTN_UP = '[data-testid="trail-item-reorder-up"]';

/** Seletor dos botões "Mover para baixo" */
const BTN_DOWN = '[data-testid="trail-item-reorder-down"]';

/** Seletor do container de reordenação de cada item */
const REORDER_CONTAINER = '[data-testid="trail-item-reorder"]';

/** Seletor da lista de módulos */
const MODULES_LIST = '[data-testid="modules-list"]';

// ---------------------------------------------------------------------------
// Testes US4 — Builder de Trilhas
// ---------------------------------------------------------------------------

test.describe("US4 — Builder de Trilhas: reordenação por teclado", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BUILDER_URL, { waitUntil: "networkidle" });
  });

  test(
    "AC1: botões de reordenação estão visíveis sem hover ou focus (CL-004 / dec-014)",
    async ({ page }) => {
      // Verifica que os botões existem no DOM desde o carregamento
      const upButtons = page.locator(BTN_UP);
      const downButtons = page.locator(BTN_DOWN);

      const upCount = await upButtons.count();
      const downCount = await downButtons.count();

      // Deve haver pelo menos um par de botões (um módulo/item)
      expect(upCount).toBeGreaterThan(0);
      expect(downCount).toBeGreaterThan(0);

      // Verificar visibilidade: os botões não dependem de hover
      // (CSS: não usam opacity-0 group-hover:opacity-100)
      const firstUp = upButtons.first();
      await expect(firstUp).toBeVisible();

      const firstDown = downButtons.first();
      await expect(firstDown).toBeVisible();

      // Checar que não há CSS visibility:hidden ou display:none sem interação
      const upStyle = await firstUp.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
        };
      });

      expect(upStyle.display).not.toBe("none");
      expect(upStyle.visibility).not.toBe("hidden");
      // Opacity >= 0.4 (disabled) ou 1 (enabled) — nunca 0
      expect(parseFloat(upStyle.opacity)).toBeGreaterThan(0);
    },
  );

  test(
    "AC2: aria-label dos botões inclui o título do item (FR-012)",
    async ({ page }) => {
      // Pegar o título do primeiro módulo
      const firstModuleTitle = await page
        .locator('[data-testid^="module-title-"]')
        .first()
        .textContent();

      if (!firstModuleTitle) {
        test.skip();
        return;
      }

      const titulo = firstModuleTitle.trim();

      // Verificar que existe botão com aria-label contendo o título
      const upBtn = page.locator(
        `button[aria-label="Mover ${titulo} para cima"]`,
      );
      const downBtn = page.locator(
        `button[aria-label="Mover ${titulo} para baixo"]`,
      );

      await expect(upBtn).toBeAttached();
      await expect(downBtn).toBeAttached();
    },
  );

  test(
    "AC3: Enter no botão 'para baixo' move o módulo; foco permanece no botão (FR-013)",
    async ({ page }) => {
      const moduleItems = page.locator('[data-testid^="module-item-"]');
      const count = await moduleItems.count();

      if (count < 2) {
        test.skip();
        return;
      }

      // Capturar título do primeiro módulo antes de mover
      const firstTitle = await page
        .locator('[data-testid^="module-title-"]')
        .first()
        .textContent();

      // Focar o primeiro botão "para baixo" via Tab
      await page.keyboard.press("Tab");

      // Navegar até o primeiro botão "mover para baixo" habilitado
      // (o botão "para cima" do primeiro item é disabled, então Tab vai direto para "para baixo")
      const firstEnabledDown = page.locator(`${BTN_DOWN}:not([disabled])`).first();
      await firstEnabledDown.focus();

      // Verificar que está focado
      const isFocused = await firstEnabledDown.evaluate(
        (el) => document.activeElement === el,
      );
      expect(isFocused).toBe(true);

      // Ativar com Enter
      await page.keyboard.press("Enter");

      // Aguardar re-render
      await page.waitForTimeout(100);

      // FR-013: foco deve permanecer no botão "para baixo" do item movido
      // (o item agora está na posição 2 — o botão ref é restaurado via requestAnimationFrame)
      const focusedAriaLabel = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute("aria-label") ?? "";
      });

      // O aria-label deve conter o título original + "para baixo"
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
      const count = await moduleItems.count();

      if (count < 2) {
        test.skip();
        return;
      }

      // Focar o último botão "para cima" habilitado (segundo módulo)
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

      // FR-013: foco deve permanecer no botão "para cima" do item
      const focusedAriaLabel = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute("aria-label") ?? "";
      });

      // O aria-label deve conter "para cima"
      expect(focusedAriaLabel).toContain("para cima");
      // Verificar que é o mesmo item (não saltou para outro)
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

      // Verificar que os botões de reordenação (TrailItemReorder) são
      // renderizados antes do título no DOM (ordem top-to-bottom)
      const firstItem = page.locator('[data-testid^="module-item-"]').first();
      const reorderContainer = firstItem.locator(REORDER_CONTAINER);
      const moduleTitle = firstItem.locator('[data-testid^="module-title-"]');

      await expect(reorderContainer).toBeAttached();
      await expect(moduleTitle).toBeAttached();

      // Verificar posição DOM: reorder container deve preceder o título
      const orderOk = await page.evaluate(() => {
        const item = document.querySelector('[data-testid^="module-item-"]');
        if (!item) return false;
        const reorder = item.querySelector('[data-testid="trail-item-reorder"]');
        const title = item.querySelector('[data-testid^="module-title-"]');
        if (!reorder || !title) return false;
        // Node.DOCUMENT_POSITION_FOLLOWING (4) — reorder vem antes de title
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
      // O primeiro botão "para cima" deve estar disabled e não receber Tab
      const firstUpBtn = page.locator(BTN_UP).first();
      const isDisabled = await firstUpBtn.getAttribute("disabled");

      // Se o primeiro item está no topo, o botão "para cima" é disabled
      if (isDisabled !== null) {
        // Navegar por Tab — não deve focar um botão disabled
        await page.keyboard.press("Tab");
        const focusedTestId = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el?.getAttribute("data-testid") ?? "";
        });
        // O elemento focado não é o botão up disabled
        expect(focusedTestId).not.toBe("trail-item-reorder-up");
      }
    },
  );

  test(
    "anúncio ARIA live após reordenação (CHK004)",
    async ({ page }) => {
      const moduleItems = page.locator('[data-testid^="module-item-"]');
      const count = await moduleItems.count();

      if (count < 2) {
        test.skip();
        return;
      }

      // Ativar botão "para baixo" do primeiro módulo
      const firstEnabledDown = page.locator(`${BTN_DOWN}:not([disabled])`).first();
      await firstEnabledDown.click();

      // Aguardar anúncio ARIA live (AsyncAnnouncer usa 3s de clearAfterMs)
      const politeRegion = page.locator('[data-testid="async-announcer-polite"]');

      await expect(politeRegion).toContainText(/movido para a posição/, {
        timeout: 2_000,
      });
    },
  );
});
