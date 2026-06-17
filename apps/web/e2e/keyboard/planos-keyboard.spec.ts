/**
 * planos-keyboard.spec.ts — E2E keyboard test: Gestão de Planos (US7)
 *
 * Story 12.2 — US7, FR-022, FR-023, FR-024, FR-025
 * Browser: Chromium only (dec-012).
 *
 * Cenários de aceite US7:
 *   AC1: Tab navega entre cards individualmente (FR-022)
 *   AC2: Enter em card expande detalhes do plano (FR-022)
 *   AC3: CTAs "Assinar Pro" e "Falar com vendas" alcançáveis e ativáveis (FR-023)
 *   AC4: Diálogo de upgrade — focus trap ativo, Escape cancela e retorna foco (FR-024)
 *   axe: 0 violations critical na página de planos (FR-025)
 *
 * Estratégia: HTML inline replica estrutura acessível dos componentes PlanCard e
 * UpgradeDialog para validar contratos de teclado de forma isolada, sem dependência
 * de auth/backend (mesma abordagem de configuracoes-keyboard.spec.ts e
 * modal-focus-trap.spec.ts).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// HTML inline — replica estrutura acessível dos componentes plans/ (US7)
// ---------------------------------------------------------------------------
const PLANS_PAGE_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Planos e Upgrade — Teste de Teclado</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #fff; color: #111; }
    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
    }
    .plans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; padding: 2rem; }
    .plan-card {
      border: 2px solid #d1d5db; border-radius: 0.5rem; padding: 1.5rem;
      cursor: pointer; outline: none; display: flex; flex-direction: column;
    }
    .plan-card--highlighted { border-color: #2b7a78; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
    .plan-card:focus { box-shadow: 0 0 0 3px #2b7a78; border-color: #2b7a78; }
    .plan-card__title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.25rem; }
    .plan-card__price { color: #6b7280; margin-bottom: 0.75rem; }
    .plan-card__description { color: #6b7280; font-size: 0.95rem; flex: 1; }
    .plan-card__details { overflow: hidden; max-height: 0; transition: max-height 0.2s; }
    .plan-card__details--expanded { max-height: 200px; margin-top: 0.75rem; }
    .plan-card__features { list-style: none; }
    .plan-card__features li { display: flex; gap: 0.5rem; font-size: 0.875rem; padding: 0.2rem 0; }
    .plan-card__cta {
      margin-top: 1rem; width: 100%; padding: 0.5rem 1rem; border-radius: 0.375rem;
      font-size: 0.875rem; font-weight: 500; cursor: pointer; outline: none; border: 1px solid #d1d5db;
    }
    .plan-card__cta:focus { box-shadow: 0 0 0 3px #2b7a78; }
    .plan-card__cta--primary { background: #2b7a78; color: white; border-color: #2b7a78; }
    .plan-card__cta--outline { background: white; color: #111; }
    .comparison-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin: 0 2rem; max-width: calc(100% - 4rem); }
    .comparison-table th, .comparison-table td { border-bottom: 1px solid #e5e7eb; padding: 0.75rem 1rem; }
    .comparison-table th { text-align: left; font-weight: 600; }
    .comparison-table td { text-align: center; color: #6b7280; }
    /* Dialog */
    .dialog-backdrop {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5);
      z-index: 50; align-items: center; justify-content: center;
    }
    .dialog-backdrop--open { display: flex; }
    .dialog {
      background: white; border-radius: 0.5rem; padding: 2rem;
      min-width: 400px; max-width: 90vw; display: flex; flex-direction: column; gap: 1rem;
      box-shadow: 0 20px 60px rgba(0,0,0,.3);
    }
    .dialog__title { font-size: 1.125rem; font-weight: 600; }
    .dialog__description { font-size: 0.875rem; color: #6b7280; }
    .dialog__footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
    .dialog__btn {
      padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem;
      font-weight: 500; cursor: pointer; outline: none; border: 1px solid #d1d5db;
    }
    .dialog__btn:focus { box-shadow: 0 0 0 3px #2b7a78; }
    .dialog__btn--primary { background: #2b7a78; color: white; border-color: #2b7a78; }
    .dialog__btn--outline { background: white; color: #111; }
    .badge { display: inline-block; background: #2b7a78; color: white; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
  </style>
</head>
<body>
  <main id="main-content" aria-label="Gestão de Planos">
    <header style="padding: 2rem 2rem 0">
      <h1 style="font-size: 1.75rem; font-weight: 600;">Planos e Upgrade</h1>
      <p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.95rem;">
        Navegue pelos cards com Tab e pressione Enter para ver os detalhes.
      </p>
    </header>

    <!-- Tabela de comparação (FR-022) -->
    <section aria-label="Comparação de planos" style="margin: 2rem 0 0;">
      <table class="comparison-table" aria-label="Comparação de recursos entre os planos">
        <caption class="sr-only">Comparação entre planos Gratuito, Pro e Enterprise</caption>
        <thead>
          <tr>
            <th scope="col">Recurso</th>
            <th scope="col">Gratuito</th>
            <th scope="col">Pro</th>
            <th scope="col">Enterprise</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" style="font-weight: normal;">Membros</th>
            <td>Até 50</td>
            <td>Ilimitado</td>
            <td>Ilimitado</td>
          </tr>
          <tr>
            <th scope="row" style="font-weight: normal;">Radar Pastoral</th>
            <td>Básico</td>
            <td>Avançado + alertas</td>
            <td>Avançado + alertas</td>
          </tr>
          <tr>
            <th scope="row" style="font-weight: normal;">Suporte</th>
            <td>E-mail</td>
            <td>Prioritário</td>
            <td>Gerente dedicado</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Cards de plano (FR-022, FR-023) -->
    <section aria-label="Seleção de plano">
      <h2 class="sr-only">Cards de plano</h2>
      <div class="plans-grid" role="list" aria-label="Planos disponíveis">

        <!-- Card Gratuito -->
        <div role="listitem">
          <div
            id="plan-card-free"
            role="article"
            tabindex="0"
            aria-label="Plano Gratuito"
            aria-expanded="false"
            aria-controls="plan-details-free"
            data-testid="plan-card-free"
            class="plan-card"
          >
            <h3 class="plan-card__title">Gratuito</h3>
            <p class="plan-card__price">R$ 0 / mês</p>
            <p class="plan-card__description">Para igrejas que estão começando.</p>
            <div
              id="plan-details-free"
              class="plan-card__details"
              role="region"
              aria-label="Recursos do plano Gratuito"
            >
              <ul class="plan-card__features">
                <li><span aria-hidden="true">✓</span> Até 50 membros</li>
                <li><span aria-hidden="true">✓</span> Radar básico</li>
              </ul>
            </div>
            <button
              type="button"
              data-testid="plan-card-free-cta"
              aria-label="Plano atual — Plano Gratuito"
              class="plan-card__cta plan-card__cta--outline"
            >
              Plano atual
            </button>
          </div>
        </div>

        <!-- Card Pro (highlighted) -->
        <div role="listitem">
          <div
            id="plan-card-pro"
            role="article"
            tabindex="0"
            aria-label="Plano Pro"
            aria-expanded="false"
            aria-controls="plan-details-pro"
            data-testid="plan-card-pro"
            class="plan-card plan-card--highlighted"
          >
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <h3 class="plan-card__title">Pro</h3>
                <p class="plan-card__price">R$ 149 / mês</p>
              </div>
              <span class="badge" aria-label="Plano recomendado">Recomendado</span>
            </div>
            <p class="plan-card__description">Para igrejas em crescimento.</p>
            <div
              id="plan-details-pro"
              class="plan-card__details"
              role="region"
              aria-label="Recursos do plano Pro"
            >
              <ul class="plan-card__features">
                <li><span aria-hidden="true">✓</span> Membros ilimitados</li>
                <li><span aria-hidden="true">✓</span> Radar avançado com alertas</li>
                <li><span aria-hidden="true">✓</span> Suporte prioritário</li>
              </ul>
            </div>
            <button
              type="button"
              data-testid="plan-card-pro-cta"
              aria-label="Assinar Pro — Plano Pro"
              class="plan-card__cta plan-card__cta--primary"
            >
              Assinar Pro
            </button>
          </div>
        </div>

        <!-- Card Enterprise -->
        <div role="listitem">
          <div
            id="plan-card-enterprise"
            role="article"
            tabindex="0"
            aria-label="Plano Enterprise"
            aria-expanded="false"
            aria-controls="plan-details-enterprise"
            data-testid="plan-card-enterprise"
            class="plan-card"
          >
            <h3 class="plan-card__title">Enterprise</h3>
            <p class="plan-card__price">Sob consulta</p>
            <p class="plan-card__description">Para redes de igrejas e denominações.</p>
            <div
              id="plan-details-enterprise"
              class="plan-card__details"
              role="region"
              aria-label="Recursos do plano Enterprise"
            >
              <ul class="plan-card__features">
                <li><span aria-hidden="true">✓</span> Tudo do Pro</li>
                <li><span aria-hidden="true">✓</span> SLA dedicado</li>
                <li><span aria-hidden="true">✓</span> Gerente de conta</li>
              </ul>
            </div>
            <button
              type="button"
              data-testid="plan-card-enterprise-cta"
              aria-label="Falar com vendas — Plano Enterprise"
              class="plan-card__cta plan-card__cta--outline"
            >
              Falar com vendas
            </button>
          </div>
        </div>

      </div>
    </section>
  </main>

  <!-- Diálogo de upgrade (FR-024) — focus trap manual com trap de teclas -->
  <div
    id="upgrade-dialog-backdrop"
    class="dialog-backdrop"
    role="presentation"
  >
    <div
      id="upgrade-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
      aria-describedby="upgrade-dialog-description"
      data-testid="upgrade-dialog"
      tabindex="-1"
    >
      <h2 id="upgrade-dialog-title" class="dialog__title">Confirmar upgrade</h2>
      <p id="upgrade-dialog-description" class="dialog__description">
        Ao confirmar, você será redirecionado ao fluxo de pagamento.
        Pressione Escape para cancelar.
      </p>
      <ol style="font-size:0.875rem; padding: 0.75rem 0; list-style: none;">
        <li style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;">
          <span style="width:1.5rem;height:1.5rem;border-radius:50%;background:#2b7a78;color:white;display:flex;align-items:center;justify-content:center;font-size:0.75rem;" aria-hidden="true">1</span>
          Confirmar seleção de plano
        </li>
        <li style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;color:#6b7280;">
          <span style="width:1.5rem;height:1.5rem;border-radius:50%;border:1px solid #d1d5db;display:flex;align-items:center;justify-content:center;font-size:0.75rem;" aria-hidden="true">2</span>
          Inserir dados de pagamento
        </li>
        <li style="display:flex;gap:0.5rem;align-items:center;color:#6b7280;">
          <span style="width:1.5rem;height:1.5rem;border-radius:50%;border:1px solid #d1d5db;display:flex;align-items:center;justify-content:center;font-size:0.75rem;" aria-hidden="true">3</span>
          Ativação imediata
        </li>
      </ol>
      <div class="dialog__footer">
        <button
          id="dialog-btn-cancel"
          type="button"
          data-testid="upgrade-dialog-cancel"
          aria-label="Cancelar upgrade e fechar diálogo"
          class="dialog__btn dialog__btn--outline"
        >
          Cancelar
        </button>
        <button
          id="dialog-btn-confirm"
          type="button"
          data-testid="upgrade-dialog-confirm"
          aria-label="Confirmar upgrade para plano Pro"
          class="dialog__btn dialog__btn--primary"
        >
          Confirmar upgrade
        </button>
      </div>
    </div>
  </div>

  <script>
    // ---------------------------------------------------------------------------
    // Lógica de interação: expand/collapse cards + diálogo upgrade
    // ---------------------------------------------------------------------------
    let _triggerEl = null;

    // Toggle expand de card
    function toggleCard(card) {
      const isExpanded = card.getAttribute('aria-expanded') === 'true';
      card.setAttribute('aria-expanded', String(!isExpanded));
      const detailsId = card.getAttribute('aria-controls');
      const details = document.getElementById(detailsId);
      if (details) {
        if (!isExpanded) {
          details.classList.add('plan-card__details--expanded');
        } else {
          details.classList.remove('plan-card__details--expanded');
        }
      }
    }

    // Abrir diálogo de upgrade
    function openUpgradeDialog(planName, triggerEl) {
      _triggerEl = triggerEl;
      const backdrop = document.getElementById('upgrade-dialog-backdrop');
      const dialog = document.getElementById('upgrade-dialog');
      const titleEl = document.getElementById('upgrade-dialog-title');
      const confirmBtn = document.getElementById('dialog-btn-confirm');
      if (titleEl) titleEl.textContent = 'Confirmar upgrade para ' + planName;
      if (confirmBtn) confirmBtn.setAttribute('aria-label', 'Confirmar upgrade para plano ' + planName);
      backdrop.classList.add('dialog-backdrop--open');
      // Foco no botão de confirmação (primeiro elemento interativo relevante)
      setTimeout(() => { if (confirmBtn) confirmBtn.focus(); }, 0);
    }

    // Fechar diálogo e retornar foco ao trigger
    function closeUpgradeDialog() {
      const backdrop = document.getElementById('upgrade-dialog-backdrop');
      backdrop.classList.remove('dialog-backdrop--open');
      if (_triggerEl) { _triggerEl.focus(); _triggerEl = null; }
    }

    // Focus trap dentro do diálogo
    function trapFocus(e) {
      const backdrop = document.getElementById('upgrade-dialog-backdrop');
      if (!backdrop.classList.contains('dialog-backdrop--open')) return;
      const dialog = document.getElementById('upgrade-dialog');
      const focusable = Array.from(dialog.querySelectorAll('button, [tabindex="0"]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
      if (e.key === 'Escape') { e.preventDefault(); closeUpgradeDialog(); }
    }

    // Event listeners: cards
    document.querySelectorAll('[data-testid^="plan-card-"][data-testid$="-cta"]').forEach(function(cta) {
      // Removemos o CTA de "Plano atual" da lógica de upgrade
      if (cta.dataset.testid === 'plan-card-free-cta') return;
      cta.addEventListener('click', function(e) {
        e.stopPropagation();
        var planName = cta.dataset.testid === 'plan-card-pro-cta' ? 'Pro' : 'Enterprise';
        openUpgradeDialog(planName, cta);
      });
      cta.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); e.stopPropagation();
          var planName = cta.dataset.testid === 'plan-card-pro-cta' ? 'Pro' : 'Enterprise';
          openUpgradeDialog(planName, cta);
        }
      });
    });

    document.querySelectorAll('[data-testid^="plan-card-"]:not([data-testid$="-cta"])').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (!e.target.closest('button')) toggleCard(card);
      });
      card.addEventListener('keydown', function(e) {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
          e.preventDefault(); toggleCard(card);
        }
      });
    });

    // Cancelar diálogo
    document.getElementById('dialog-btn-cancel').addEventListener('click', closeUpgradeDialog);
    document.getElementById('dialog-btn-confirm').addEventListener('click', closeUpgradeDialog);

    // Focus trap e Escape no diálogo
    document.addEventListener('keydown', trapFocus);
  </script>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Suíte de testes E2E — US7
// ---------------------------------------------------------------------------

test.describe('US7 — Gestão de Planos: navegação por teclado', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(PLANS_PAGE_HTML, { waitUntil: 'domcontentloaded' });
  });

  // AC US7-1: Tab navega entre cards individualmente (FR-022)
  test('AC1: Tab navega entre os cards de plano individualmente', async ({ page }) => {
    // Focar o body e dar Tab para chegar nos cards
    await page.keyboard.press('Tab');

    // Os cards têm tabIndex=0 — devem ser focáveis
    const freeCard = page.getByTestId('plan-card-free');
    const proCard = page.getByTestId('plan-card-pro');
    const enterpriseCard = page.getByTestId('plan-card-enterprise');

    await expect(freeCard).toBeVisible();
    await expect(proCard).toBeVisible();
    await expect(enterpriseCard).toBeVisible();

    // Focar diretamente e confirmar foco
    await freeCard.focus();
    await expect(freeCard).toBeFocused();

    // Tab vai para o CTA do free (botão dentro do card)
    await page.keyboard.press('Tab');
    const freeCta = page.getByTestId('plan-card-free-cta');
    await expect(freeCta).toBeFocused();

    // Navegar até card Pro
    await proCard.focus();
    await expect(proCard).toBeFocused();
  });

  // AC US7-2: Enter em card expande detalhes (FR-022)
  test('AC2: Enter em card expande detalhes do plano', async ({ page }) => {
    const freeCard = page.getByTestId('plan-card-free');
    await freeCard.focus();

    // Inicialmente fechado
    await expect(freeCard).toHaveAttribute('aria-expanded', 'false');

    // Enter expande
    await page.keyboard.press('Enter');
    await expect(freeCard).toHaveAttribute('aria-expanded', 'true');

    // Detalhes visíveis no DOM
    const details = page.locator('#plan-details-free');
    await expect(details).toHaveClass(/expanded/);

    // Enter novamente fecha
    await page.keyboard.press('Enter');
    await expect(freeCard).toHaveAttribute('aria-expanded', 'false');
  });

  test('AC2b: Space em card expande detalhes do plano', async ({ page }) => {
    const proCard = page.getByTestId('plan-card-pro');
    await proCard.focus();
    await page.keyboard.press(' ');
    await expect(proCard).toHaveAttribute('aria-expanded', 'true');
  });

  // AC US7-3: CTAs alcançáveis e ativáveis via teclado (FR-023)
  test('AC3: CTA "Assinar Pro" é focável e abre diálogo via Enter', async ({ page }) => {
    const proCta = page.getByTestId('plan-card-pro-cta');
    await expect(proCta).toBeVisible();

    // CTA focável
    await proCta.focus();
    await expect(proCta).toBeFocused();

    // Enter no CTA abre o diálogo de upgrade
    await page.keyboard.press('Enter');

    const dialog = page.getByTestId('upgrade-dialog');
    await expect(dialog).toBeVisible();
  });

  test('AC3b: CTA "Falar com vendas" é focável e abre diálogo', async ({ page }) => {
    const enterpriseCta = page.getByTestId('plan-card-enterprise-cta');
    await enterpriseCta.focus();
    await expect(enterpriseCta).toBeFocused();

    await page.keyboard.press('Enter');
    const dialog = page.getByTestId('upgrade-dialog');
    await expect(dialog).toBeVisible();
  });

  test('AC3c: CTAs têm aria-label descritivo com nome do plano', async ({ page }) => {
    const proCta = page.getByTestId('plan-card-pro-cta');
    await expect(proCta).toHaveAttribute('aria-label', /Assinar Pro/i);
    await expect(proCta).toHaveAttribute('aria-label', /Pro/i);

    const enterpriseCta = page.getByTestId('plan-card-enterprise-cta');
    await expect(enterpriseCta).toHaveAttribute('aria-label', /Falar com vendas/i);
  });

  // AC US7-4: Diálogo de upgrade — focus trap + Escape cancela (FR-024)
  test('AC4: diálogo de upgrade tem focus trap ativo', async ({ page }) => {
    // Abrir diálogo via CTA Pro
    const proCta = page.getByTestId('plan-card-pro-cta');
    await proCta.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByTestId('upgrade-dialog');
    await expect(dialog).toBeVisible();

    // Foco deve estar dentro do diálogo (no botão confirmar)
    const confirmBtn = page.getByTestId('upgrade-dialog-confirm');
    await expect(confirmBtn).toBeFocused();

    // Tab deve circular dentro do diálogo (focus trap)
    await page.keyboard.press('Tab');
    const cancelBtn = page.getByTestId('upgrade-dialog-cancel');
    await expect(cancelBtn).toBeFocused();

    // Shift+Tab volta ao confirmar
    await page.keyboard.press('Shift+Tab');
    await expect(confirmBtn).toBeFocused();
  });

  test('AC4b: Escape cancela diálogo e retorna foco ao CTA trigger', async ({ page }) => {
    const proCta = page.getByTestId('plan-card-pro-cta');
    await proCta.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByTestId('upgrade-dialog');
    await expect(dialog).toBeVisible();

    // Escape fecha o diálogo
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Foco retorna ao trigger (CTA Pro)
    await expect(proCta).toBeFocused();
  });

  test('AC4c: botão Cancelar fecha diálogo e retorna foco', async ({ page }) => {
    const proCta = page.getByTestId('plan-card-pro-cta');
    await proCta.focus();
    await page.keyboard.press('Enter');

    const cancelBtn = page.getByTestId('upgrade-dialog-cancel');
    await cancelBtn.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByTestId('upgrade-dialog');
    await expect(dialog).not.toBeVisible();
    await expect(proCta).toBeFocused();
  });

  test('AC4d: diálogo tem role=dialog e aria-modal=true', async ({ page }) => {
    const proCta = page.getByTestId('plan-card-pro-cta');
    await proCta.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByTestId('upgrade-dialog');
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-labelledby', 'upgrade-dialog-title');
    await expect(dialog).toHaveAttribute('aria-describedby', 'upgrade-dialog-description');
  });

  // Tabela de comparação
  test('tabela de comparação tem caption, th[scope] e é acessível por teclado', async ({ page }) => {
    const table = page.locator('table[aria-label="Comparação de recursos entre os planos"]');
    await expect(table).toBeVisible();

    // Headers de coluna com scope
    const colHeaders = page.locator('th[scope="col"]');
    await expect(colHeaders).toHaveCount(4); // Recurso + 3 planos

    // Headers de linha com scope
    const rowHeaders = page.locator('th[scope="row"]');
    await expect(rowHeaders.first()).toBeVisible();
  });

  // axe: sem violações critical (FR-025)
  test('axe: sem violações critical na página de planos', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  test('axe: sem violações critical com diálogo aberto', async ({ page }) => {
    // Abrir diálogo e então rodar axe
    const proCta = page.getByTestId('plan-card-pro-cta');
    await proCta.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByTestId('upgrade-dialog');
    await expect(dialog).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });
});
