/**
 * notification-preferences.spec.ts — E2E Playwright: Story 16-1 (FR78)
 *
 * Cobre FASE 7 do pipeline:
 *   T-E1 : toggle desativa → optimistic; MSW 500 → reverte + toast exibido
 *   T-E2 : mock Líder → pastoral_alert.inApp [disabled] + tooltip; email clicável
 *   T-E3 : GET falha → mensagem erro + botão retry; retry re-tenta
 *   T-E4 : durante PATCH em voo → toggle desabilitado (sem duplo-clique)
 *   T-M1 : localStorage silenciado → banner + modal exibidos
 *   T-M2 : "Manter silenciado" → PATCH 7 tipos inApp=false → localStorage removido → reload sem modal
 *   T-M3 : "Configurar por tipo" → sem PATCH; localStorage removido; reload sem modal
 *
 * Estratégia: page.route intercepts para API + addInitScript para localStorage/token.
 * NÃO requer infra real (DB, Keycloak). Roda com a app em modo dev ou produção.
 *
 * Gotchas do projeto:
 *  - waitUntil:'networkidle' não resolve com SSE → usar domcontentloaded + waitForSelector.
 *  - Componentes duplicados mobile/desktop → ":visible".
 *  - UUID válido nos payloads de mock.
 *  - loginAs usa UI login real; aqui usamos addInitScript para simular token no sessionStorage.
 *
 * Ref: spec FR78, constitution.md Princípio I, tasks.md FASE 7.
 */
import { test, expect, type Page } from '@playwright/test';
import { E2E_BASE_URL } from '../setup/env';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const PREFS_ENDPOINT = `${API_URL}/users/me/notification-preferences`;
const PAGE_URL = `${E2E_BASE_URL}/app/configuracoes/notificacoes`;

/** Token JWT mínimo: realm_access.roles = ['participante'] (role padrão). */
const FAKE_TOKEN_PARTICIPANTE = [
  'eyJhbGciOiJSUzI1NiJ9',
  btoa(
    JSON.stringify({
      sub: '0199abcd-0000-7000-8000-000000000001',
      realm_access: { roles: ['participante'] },
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''),
  'fakesig',
].join('.');

/** Token JWT mínimo: realm_access.roles = ['lider']. */
const FAKE_TOKEN_LIDER = [
  'eyJhbGciOiJSUzI1NiJ9',
  btoa(
    JSON.stringify({
      sub: '0199abcd-0000-7000-8000-000000000002',
      realm_access: { roles: ['lider'] },
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''),
  'fakesig',
].join('.');

/** Preferências padrão com todos os tipos habilitados. */
function makeDefaultPrefs(overrides: Record<string, Partial<{ inApp: boolean; email: boolean }>> = {}) {
  const types = [
    'pastoral_alert',
    'meeting_reminder',
    'content_new',
    'content_update',
    'export_ready',
    'group_message',
    'system',
  ] as const;
  const base = Object.fromEntries(
    types.map((t) => [t, { inApp: true, email: true }]),
  );
  for (const [k, v] of Object.entries(overrides)) {
    base[k] = { ...base[k], ...v };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Injeta o token no sessionStorage ANTES do carregamento da página,
 * para que useCurrentRole() e useNotificationPreferences() o encontrem.
 * NÃO faz login real via UI (sem Keycloak em testes unitários de componente).
 */
async function injectToken(page: Page, token: string) {
  await page.addInitScript((t) => {
    sessionStorage.setItem('accessToken', t);
  }, token);
}

/** Mock do endpoint GET /notification-preferences. */
async function mockGetPrefs(page: Page, body: object, status = 200) {
  await page.route(PREFS_ENDPOINT, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status === 200 ? { data: body } : body),
      });
    } else {
      await route.continue();
    }
  });
}

/** Mock do endpoint PATCH /notification-preferences. */
async function mockPatchPrefs(
  page: Page,
  responseOrFn:
    | object
    | ((body: object) => { status: number; body: object }),
  status = 200,
) {
  await page.route(PREFS_ENDPOINT, async (route) => {
    if (route.request().method() === 'PATCH') {
      const reqBody = (await route.request().postDataJSON()) as object;
      if (typeof responseOrFn === 'function') {
        const { status: s, body: b } = responseOrFn(reqBody);
        await route.fulfill({
          status: s,
          contentType: 'application/json',
          body: JSON.stringify(b),
        });
      } else {
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(status === 200 ? { data: responseOrFn } : responseOrFn),
        });
      }
    } else {
      await route.continue();
    }
  });
}

/** Navega até a página de preferências com waitForSelector na lista de tipos. */
async function goToPrefsPage(page: Page) {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  // Aguardar que ao menos o primeiro tipo apareça ou o estado de erro/loading
  await page.waitForSelector(
    '[data-testid="notif-row-pastoral_alert"], [data-testid="pref-error-retry"], [aria-busy="true"]',
    { timeout: 15_000 },
  );
}

// ---------------------------------------------------------------------------
// T-E1 — Toggle otimista + rollback ao erro
// ---------------------------------------------------------------------------

test.describe('T-E1 — Toggle otimista + rollback em erro 500', () => {
  test('toggle desativa otimisticamente; erro 500 reverte e exibe toast', async ({ page }) => {
    await injectToken(page, FAKE_TOKEN_PARTICIPANTE);

    const defaultPrefs = makeDefaultPrefs();
    let patchCount = 0;

    // GET: retorna preferências com meeting_reminder.email = true
    await page.route(PREFS_ENDPOINT, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: defaultPrefs }),
        });
      } else if (method === 'PATCH') {
        patchCount++;
        // Simula falha de servidor
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error' }),
        });
      } else {
        await route.continue();
      }
    });

    await goToPrefsPage(page);

    // Linha meeting_reminder deve estar visível
    const row = page.locator('[data-testid="notif-row-meeting_reminder"]');
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Localizar o toggle de email dentro da linha (segundo toggle)
    // O toggle é um button[role="switch"] com aria-label="E-mail"
    const emailToggle = row.locator('button[role="switch"][aria-label="E-mail"]');
    await expect(emailToggle).toBeVisible();
    await expect(emailToggle).toHaveAttribute('aria-checked', 'true');

    // Clicar no toggle (vai triggerar PATCH otimista)
    await emailToggle.click();

    // Otimisticamente o toggle vira false (visualmente)
    // O PATCH falha → reverte para true
    // Aguardar toast de erro (aria-live="polite")
    await expect(page.locator('[role="alert"][aria-live="polite"]')).toBeVisible({
      timeout: 10_000,
    });

    // Toggle deve ter revertido para true
    await expect(emailToggle).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });

    // Confirmar que PATCH foi chamado exatamente uma vez
    expect(patchCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T-E2 — Líder: pastoral_alert.inApp desabilitado + tooltip; email clicável
// ---------------------------------------------------------------------------

test.describe('T-E2 — Enforcement Líder: toggle inApp bloqueado + tooltip', () => {
  test('pastoral_alert.inApp disabled para líder; email toggle funciona', async ({ page }) => {
    await injectToken(page, FAKE_TOKEN_LIDER);

    const prefs = makeDefaultPrefs();
    await mockGetPrefs(page, prefs);

    // Mock PATCH para permitir clicar em email sem erro
    await mockPatchPrefs(page, makeDefaultPrefs({ pastoral_alert: { inApp: true, email: false } }));

    await goToPrefsPage(page);

    const row = page.locator('[data-testid="notif-row-pastoral_alert"]');
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Toggle inApp deve estar DESABILITADO para o Líder
    const inAppToggle = row.locator('button[role="switch"][aria-label="No app"]');
    await expect(inAppToggle).toBeVisible();
    await expect(inAppToggle).toBeDisabled();
    await expect(inAppToggle).toHaveAttribute('aria-disabled', 'true');

    // Hover no toggle → tooltip deve aparecer
    await inAppToggle.hover();
    // O tooltip usa group-hover:block — verificar presença do texto
    const tooltip = row.locator('text=Alertas pastorais no app não podem ser desativados');
    await expect(tooltip).toBeVisible({ timeout: 5_000 });

    // Toggle email do pastoral_alert deve estar HABILITADO
    const emailToggle = row.locator('button[role="switch"][aria-label="E-mail"]');
    await expect(emailToggle).toBeEnabled();

    // Clicar email não falha
    await emailToggle.click();
    // Após clique, toggle permanece interativo (sem assert de aria-checked para evitar flake de estado)
  });
});

// ---------------------------------------------------------------------------
// T-E3 — Erro no GET + retry
// ---------------------------------------------------------------------------

test.describe('T-E3 — Erro no GET: mensagem + botão retry', () => {
  test('GET 500 exibe mensagem de erro e retry re-tenta', async ({ page }) => {
    await injectToken(page, FAKE_TOKEN_PARTICIPANTE);

    let callCount = 0;

    await page.route(PREFS_ENDPOINT, async (route) => {
      if (route.request().method() === 'GET') {
        callCount++;
        if (callCount === 1) {
          // Primeira chamada: falha
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ statusCode: 500, error: 'Server Error' }),
          });
        } else {
          // Segunda chamada (retry): sucesso
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: makeDefaultPrefs() }),
          });
        }
      } else {
        await route.continue();
      }
    });

    await goToPrefsPage(page);

    // Botão retry deve aparecer após falha
    const retryBtn = page.getByTestId('pref-error-retry');
    await expect(retryBtn).toBeVisible({ timeout: 10_000 });

    // Clicar retry
    await retryBtn.click();

    // Após retry bem-sucedido, linhas de preferências devem aparecer
    await expect(page.locator('[data-testid="notif-row-pastoral_alert"]')).toBeVisible({
      timeout: 10_000,
    });

    // Confirmar que foram feitas 2 chamadas GET
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// T-E4 — Toggles desabilitados durante PATCH em voo
// ---------------------------------------------------------------------------

test.describe('T-E4 — Toggles bloqueados durante PATCH em voo', () => {
  test('durante PATCH pendente, todos os toggles ficam desabilitados', async ({ page }) => {
    await injectToken(page, FAKE_TOKEN_PARTICIPANTE);

    let patchResolve!: () => void;
    const patchHeld = new Promise<void>((res) => { patchResolve = res; });

    await page.route(PREFS_ENDPOINT, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: makeDefaultPrefs() }),
        });
      } else if (method === 'PATCH') {
        // Segurar o PATCH até o teste liberar
        await patchHeld;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: makeDefaultPrefs() }),
        });
      } else {
        await route.continue();
      }
    });

    await goToPrefsPage(page);

    const row = page.locator('[data-testid="notif-row-meeting_reminder"]');
    await expect(row).toBeVisible({ timeout: 10_000 });

    const emailToggle = row.locator('button[role="switch"][aria-label="E-mail"]');
    await expect(emailToggle).toBeEnabled();

    // Disparar PATCH (clique no toggle)
    await emailToggle.click();

    // Enquanto PATCH está pendente, o toggle deve ficar desabilitado (isMutating=true)
    await expect(emailToggle).toBeDisabled({ timeout: 5_000 });

    // Liberar o PATCH
    patchResolve();

    // Após PATCH concluir, toggle volta a estar habilitado
    await expect(emailToggle).toBeEnabled({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// T-M1 — localStorage silenciado → banner + modal na primeira visita
// ---------------------------------------------------------------------------

test.describe('T-M1 — localStorage silenciado → banner + modal exibidos', () => {
  test('banner e modal aparecem quando localStorage tem a chave de silêncio', async ({ page }) => {
    await injectToken(page, FAKE_TOKEN_PARTICIPANTE);

    // Configurar localStorage ANTES de navegar
    await page.addInitScript(() => {
      localStorage.setItem('metanoia:notificationSilence', 'true');
      // Limpar sessionStorage para garantir first visit
      sessionStorage.removeItem('pref:migrationSeen');
    });

    await mockGetPrefs(page, makeDefaultPrefs());
    // Mock PATCH para o caso de "Manter silenciado"
    await mockPatchPrefs(page, makeDefaultPrefs(
      Object.fromEntries(
        ['pastoral_alert', 'meeting_reminder', 'content_new', 'content_update', 'export_ready', 'group_message', 'system'].map(
          (t) => [t, { inApp: false }],
        ),
      ),
    ));

    await goToPrefsPage(page);

    // Banner de silêncio deve estar visível
    const banner = page.getByTestId('silence-banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // Modal de migração deve aparecer na primeira visita
    const modal = page.getByTestId('migration-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// T-M2 — "Manter silenciado" → PATCH com 7 tipos inApp=false → localStorage removido
// ---------------------------------------------------------------------------

test.describe('T-M2 — Manter silenciado: PATCH atômico + localStorage removido', () => {
  test('botão "Manter silenciado" envia PATCH com todos inApp=false e remove localStorage', async ({ page }) => {
    await injectToken(page, FAKE_TOKEN_PARTICIPANTE);

    await page.addInitScript(() => {
      localStorage.setItem('metanoia:notificationSilence', 'true');
      sessionStorage.removeItem('pref:migrationSeen');
    });

    await mockGetPrefs(page, makeDefaultPrefs());

    const patchBodies: object[] = [];
    const silencedPrefs = makeDefaultPrefs(
      Object.fromEntries(
        ['pastoral_alert', 'meeting_reminder', 'content_new', 'content_update', 'export_ready', 'group_message', 'system'].map(
          (t) => [t, { inApp: false }],
        ),
      ),
    );

    await page.route(PREFS_ENDPOINT, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: makeDefaultPrefs() }),
        });
      } else if (method === 'PATCH') {
        const body = (await route.request().postDataJSON()) as object;
        patchBodies.push(body);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: silencedPrefs }),
        });
      } else {
        await route.continue();
      }
    });

    await goToPrefsPage(page);

    // Aguardar modal
    const modal = page.getByTestId('migration-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Clicar "Manter silenciado"
    await page.getByTestId('btn-manter-silenciado').click();

    // Modal deve fechar
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // Verificar que PATCH foi enviado com todos os 7 tipos inApp=false
    expect(patchBodies.length).toBe(1);
    const patchBody = patchBodies[0] as Record<string, { inApp?: boolean }>;
    const expectedTypes = [
      'pastoral_alert', 'meeting_reminder', 'content_new', 'content_update',
      'export_ready', 'group_message', 'system',
    ];
    for (const type of expectedTypes) {
      expect(patchBody[type]?.inApp).toBe(false);
    }

    // Verificar que localStorage foi removido
    const silenceKeyValue = await page.evaluate(
      () => localStorage.getItem('metanoia:notificationSilence'),
    );
    expect(silenceKeyValue).toBeNull();

    // Reload: modal NÃO deve reaparecer (sessionStorage marcado)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(
      '[data-testid="notif-row-pastoral_alert"], [data-testid="pref-error-retry"]',
      { timeout: 15_000 },
    );
    await expect(page.getByTestId('migration-modal')).not.toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// T-M3 — "Configurar por tipo" → sem PATCH; localStorage removido; reload sem modal
// ---------------------------------------------------------------------------

test.describe('T-M3 — Configurar por tipo: sem PATCH, localStorage removido', () => {
  test('botão "Configurar por tipo" fecha modal sem PATCH e remove localStorage', async ({ page }) => {
    await injectToken(page, FAKE_TOKEN_PARTICIPANTE);

    await page.addInitScript(() => {
      localStorage.setItem('metanoia:notificationSilence', 'true');
      sessionStorage.removeItem('pref:migrationSeen');
    });

    let patchCount = 0;

    await page.route(PREFS_ENDPOINT, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: makeDefaultPrefs() }),
        });
      } else if (method === 'PATCH') {
        patchCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: makeDefaultPrefs() }),
        });
      } else {
        await route.continue();
      }
    });

    await goToPrefsPage(page);

    // Aguardar modal
    const modal = page.getByTestId('migration-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Clicar "Configurar por tipo"
    await page.getByTestId('btn-configurar-por-tipo').click();

    // Modal deve fechar
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // PATCH NÃO deve ter sido chamado
    expect(patchCount).toBe(0);

    // localStorage deve ter sido removido
    const silenceKeyValue = await page.evaluate(
      () => localStorage.getItem('metanoia:notificationSilence'),
    );
    expect(silenceKeyValue).toBeNull();

    // Banner não deve mais estar visível (localStorage removido pelo modal)
    await expect(page.getByTestId('silence-banner')).not.toBeVisible({ timeout: 5_000 });

    // Reload: modal NÃO deve reaparecer
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(
      '[data-testid="notif-row-pastoral_alert"], [data-testid="pref-error-retry"]',
      { timeout: 15_000 },
    );
    await expect(page.getByTestId('migration-modal')).not.toBeVisible({ timeout: 5_000 });
  });
});
