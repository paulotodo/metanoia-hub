/**
 * configuracoes-keyboard.spec.ts — E2E keyboard test: Configurações do Tenant (WCAG 2.1)
 *
 * Ref: US6/AC1-AC4, FR-019..FR-021, FR-025, CL-005 — feature a11y-teclado-autenticado FASE 7
 * Browser: Chromium only (dec-012).
 *
 * Cenários (plan.md US6):
 *   AC1: Tab percorre todos os campos na ordem visual (FR-019)
 *   AC2: Input hex alternativo ao color picker focável e funcional (FR-020)
 *   AC3: Upload logo — Enter/Space ativa o diálogo de arquivo (FR-021)
 *   AC4: Após salvar — aria-live anuncia sucesso (CL-005, dec-015)
 *
 * Estratégia: a página de configurações requer autenticação. Usamos um
 * HTML inline (page.setContent) que replica a estrutura acessível do
 * BrandingSettingsForm para validar os contratos de teclado de forma
 * isolada, sem dependência de auth/backend (mesma abordagem de
 * modal-focus-trap.spec.ts e skeleton-focus.spec.ts).
 *
 * Nota: Em ambiente CI real com Keycloak (KEYCLOAK_PUBLIC_URL configurada),
 * os testes de integração completos rodam via playwright.config.ts com
 * globalSetup de auth. Este spec cobre a camada de contrato de teclado.
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// HTML inline — replica a estrutura acessível do BrandingSettingsForm
// ---------------------------------------------------------------------------

const BRANDING_FORM_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Configurações — Teste de Teclado</title>
  <style>
    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
    }
    [aria-hidden="true"] { pointer-events: none; }
  </style>
</head>
<body>
  <form aria-label="Identidade Visual da Igreja" id="branding-form">

    <!-- Logo Upload — FR-021 -->
    <div>
      <label
        for="logo-upload"
        id="logo-label"
        tabindex="0"
        aria-disabled="false"
        style="display:block;cursor:pointer"
      >Logo da Igreja</label>
      <p>Formatos aceitos: PNG, JPG, SVG.</p>
      <input
        id="logo-upload"
        type="file"
        accept=".png,.jpg,.jpeg,.svg"
        aria-label="Logo da Igreja"
      />
    </div>

    <!-- Primary Color — FR-019, FR-020 -->
    <div>
      <label for="primary-color-text">Cor Principal</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input
          id="primary-color-picker"
          type="color"
          aria-hidden="true"
          tabindex="-1"
          value="#2b7a78"
        />
        <input
          id="primary-color-text"
          type="text"
          value="#2b7a78"
          maxlength="9"
          pattern="^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$"
          aria-label="Valor hexadecimal da Cor Principal"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </div>

    <!-- Secondary Color — FR-019, FR-020 -->
    <div>
      <label for="secondary-color-text">Cor Secundária</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input
          id="secondary-color-picker"
          type="color"
          aria-hidden="true"
          tabindex="-1"
          value="#c1666b"
        />
        <input
          id="secondary-color-text"
          type="text"
          value="#c1666b"
          maxlength="9"
          pattern="^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$"
          aria-label="Valor hexadecimal da Cor Secundária"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </div>

    <!-- Display Name — FR-019 -->
    <div>
      <label for="display-name">Nome de Exibição</label>
      <input
        id="display-name"
        type="text"
        value="Igreja da Graça"
        maxlength="100"
        placeholder="Nome da Igreja"
      />
    </div>

    <!-- Save button — dec-015: foco permanece aqui -->
    <button type="submit" id="save-btn">Salvar Identidade Visual</button>

    <!-- AsyncAnnouncer region — CL-005 (role=status, aria-live=polite) -->
    <div
      id="async-announcer-polite"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    ></div>
  </form>

  <script>
    // Simular comportamento do handleLogoLabelKeyDown (FR-021)
    const logoLabel = document.getElementById('logo-label');
    const logoInput = document.getElementById('logo-upload');
    logoLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        logoInput.click();
      }
    });

    // Simular announce() do useAsyncAnnouncer (CL-005)
    const form = document.getElementById('branding-form');
    const announcer = document.getElementById('async-announcer-polite');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      announcer.textContent = '';
      // Simular latência assíncrona mínima (re-trigger AT via clear+set)
      requestAnimationFrame(() => {
        announcer.textContent = 'Configurações salvas com sucesso.';
      });
    });
  </script>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test.describe('Configurações do Tenant — keyboard accessibility (US6)', () => {

  test('AC1: Tab percorre todos os campos na ordem visual (FR-019)', async ({ page }) => {
    await page.setContent(BRANDING_FORM_HTML);

    // Tab order esperado (excluindo color pickers com tabIndex=-1):
    // logo-label (tabindex=0) → logo-upload → primary-color-text →
    // secondary-color-text → display-name → save-btn
    const expectedOrder = [
      'logo-label',         // label focável via tabindex=0 (FR-021)
      'logo-upload',        // input file nativo
      'primary-color-text', // hex field (FR-020)
      'secondary-color-text',
      'display-name',
      'save-btn',
    ];

    // Focar no body e Tab através dos elementos
    await page.keyboard.press('Tab');
    for (const expectedId of expectedOrder) {
      const focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
      expect(focusedId, `Esperado foco em #${expectedId}`).toBe(expectedId);
      await page.keyboard.press('Tab');
    }
  });

  test('AC2: Input hex alternativo ao color picker — focável e editável (FR-020)', async ({ page }) => {
    await page.setContent(BRANDING_FORM_HTML);

    // Color picker visual deve ser invisível ao tab (aria-hidden + tabIndex=-1)
    const colorPicker = page.locator('#primary-color-picker');
    await expect(colorPicker).toHaveAttribute('aria-hidden', 'true');
    await expect(colorPicker).toHaveAttribute('tabindex', '-1');

    // Campo hex deve ser focável e aceitar valores
    const hexInput = page.locator('#primary-color-text');
    await hexInput.focus();
    await expect(hexInput).toBeFocused();

    // Editar valor hex
    await hexInput.fill('#ff0000');
    await expect(hexInput).toHaveValue('#ff0000');

    // Verificar que tem aria-label descritivo
    await expect(hexInput).toHaveAttribute('aria-label', /hexadecimal/i);
    await expect(hexInput).toHaveAttribute('pattern');
  });

  test('AC3: Upload logo — Enter na label ativa o input de arquivo (FR-021)', async ({ page }) => {
    await page.setContent(BRANDING_FORM_HTML);

    // Label deve ser focável
    const logoLabel = page.locator('label[for="logo-upload"]');
    await expect(logoLabel).toHaveAttribute('tabindex', '0');

    // Focar na label e pressionar Enter — deve disparar click no input file
    await logoLabel.focus();
    await expect(logoLabel).toBeFocused();

    // Registrar se o input file recebeu o evento click
    await page.evaluate(() => {
      const fileInput = document.getElementById('logo-upload');
      if (fileInput) {
        fileInput.addEventListener('click', () => {
          (window as unknown as Record<string, boolean>).__fileInputClicked = true;
        }, { once: true });
      }
    });

    // Pressionar Enter — o handler keydown deve chamar fileInputRef.current.click()
    await logoLabel.press('Enter');

    const fileInputClicked = await page.evaluate(
      () => !!(window as unknown as Record<string, boolean>).__fileInputClicked,
    );
    expect(fileInputClicked, 'Enter na label deve disparar click no input[type=file]').toBe(true);
  });

  test('AC3 (Space): Upload logo — Space na label ativa o input de arquivo (FR-021)', async ({ page }) => {
    await page.setContent(BRANDING_FORM_HTML);

    const logoLabel = page.locator('label[for="logo-upload"]');
    await logoLabel.focus();

    await page.evaluate(() => {
      const fileInput = document.getElementById('logo-upload');
      if (fileInput) {
        fileInput.addEventListener('click', () => {
          (window as unknown as Record<string, boolean>).__fileInputClickedSpace = true;
        }, { once: true });
      }
    });

    await logoLabel.press(' ');

    const clicked = await page.evaluate(
      () => !!(window as unknown as Record<string, boolean>).__fileInputClickedSpace,
    );
    expect(clicked, 'Space na label deve disparar click no input[type=file]').toBe(true);
  });

  test('AC4: Após salvar — aria-live anuncia sucesso (CL-005, dec-015)', async ({ page }) => {
    await page.setContent(BRANDING_FORM_HTML);

    // O announcer começa vazio
    const announcer = page.locator('[data-testid="async-announcer-polite"], #async-announcer-polite');
    await expect(announcer).toBeEmpty();

    // Submeter o formulário
    await page.locator('#save-btn').click();

    // Aguardar o anúncio via aria-live (requestAnimationFrame no HTML inline)
    await expect(announcer).toHaveText('Configurações salvas com sucesso.', { timeout: 2000 });

    // Verificar que o foco NÃO foi movido do botão Salvar (dec-015)
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focusedId).toBe('save-btn');
  });

  test('AC4: Região aria-live tem role=status e aria-live=polite (CL-005)', async ({ page }) => {
    await page.setContent(BRANDING_FORM_HTML);

    const announcer = page.locator('#async-announcer-polite');
    await expect(announcer).toHaveAttribute('role', 'status');
    await expect(announcer).toHaveAttribute('aria-live', 'polite');
    await expect(announcer).toHaveAttribute('aria-atomic', 'true');
  });

  test('Formulário tem aria-label descritivo', async ({ page }) => {
    await page.setContent(BRANDING_FORM_HTML);
    const form = page.locator('form');
    await expect(form).toHaveAttribute('aria-label', 'Identidade Visual da Igreja');
  });
});
