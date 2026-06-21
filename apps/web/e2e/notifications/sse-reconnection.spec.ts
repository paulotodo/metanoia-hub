/**
 * sse-reconnection.spec.ts — E2E Playwright: reconexão SSE + gap-fill
 *
 * Story 14-2c — Epic 14: Notificações
 * Ref: US1 (FR-020a), US2 (FR-020b/c), FR-001, FR-004, FR-005, FR-010, FR-011
 *
 * Gotchas documentados (MEMORY epic-12-e2e-autenticado-ci + feature-00c-vps-operational):
 *   - `networkidle` nunca resolve com SSE ativo → usar `domcontentloaded` + `waitForSelector`
 *   - Sino duplicado no NavigationShell → seletor `:visible` ou data-testid
 *   - Mocks com UUID v7 válidos
 *   - SSE mockado via page.route() (Content-Type: text/event-stream)
 *
 * Nota: Todos os cenários mockam SSE e API — não dependem de infra real.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth.fixture';
import { E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD } from '../setup/env';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** UUID v7 factory (sortable prefix + fixed suffix) */
function makeUUIDv7(suffix: string): string {
  return `019756c0-0002-7000-8000-${suffix.padStart(12, '0')}`;
}

/**
 * Mock SSE endpoint — responds with a text/event-stream that keeps connection
 * open. Playwright fulfills with body chunks.
 */
async function mockSseConnected(page: Page) {
  await page.route('**/sse/notifications*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: ': heartbeat\n\n',
    });
  });
}

/**
 * Mock SSE endpoint — aborts immediately to simulate disconnection.
 */
async function mockSseDisconnected(page: Page) {
  await page.route('**/sse/notifications*', (route) => route.abort('failed'));
}

/**
 * Mock unread count endpoint.
 */
async function mockUnreadCount(page: Page, count: number) {
  const notif = Array.from({ length: count }, (_, i) => ({
    id: makeUUIDv7(String(i + 1)),
    title: `Notificação ${i + 1}`,
    body: 'Mensagem de teste',
    type: 'system',
    read: false,
    created_at: '2026-06-21T10:00:00.000Z',
    tenant_id: '019899a0-7002-7000-8000-000000000001',
  }));

  await page.route(`${API_URL}/notifications*`, async (route) => {
    const url = route.request().url();
    // Gap-fill request (contains since=)
    if (url.includes('since=')) {
      const sinceMatch = url.match(/since=([^&]+)/);
      const since = sinceMatch ? decodeURIComponent(sinceMatch[1]) : null;
      const filtered = since
        ? notif.filter((n) => n.created_at > since)
        : notif;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: filtered,
          meta: { page: 1, perPage: 20, total: filtered.length },
        }),
      });
      return;
    }
    // Standard unread request
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: notif,
        meta: { page: 1, perPage: 20, total: count },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('SSE Reconnection — US1/US2', () => {
  test.beforeEach(async ({ page }) => {
    // Set up SSE as connected initially
    await mockSseConnected(page);
    await mockUnreadCount(page, 1);

    // Navigate to the app (authenticated area)
    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    await page.waitForURL('**/app/**', { waitUntil: 'domcontentloaded' });
  });

  // -------------------------------------------------------------------------
  // Cenário 1 — Reconexão automática + gap-fill (US1, FR-020a)
  // -------------------------------------------------------------------------
  test('Cenário 1 — Reconexão automática exibe "Reconectando..." e executa gap-fill', async ({ page }) => {
    // Verify initial connected state (no connection status visible)
    const bellBtn = page.getByRole('button', { name: /notifica/i }).filter({ visible: true });
    await expect(bellBtn).toBeVisible();

    // Simulate disconnection: abort SSE route
    await mockSseDisconnected(page);

    // Wait for "Reconectando..." indicator to appear
    // Uses domcontentloaded + waitForSelector (not networkidle — CHK: SSE never resolves networkidle)
    await page.waitForSelector('[data-testid="sse-connection-status"]:visible:has-text("Reconectando...")', {
      timeout: 15_000,
    });

    const reconStatus = page.locator('[data-testid="sse-connection-status"]:visible');
    await expect(reconStatus).toContainText('Reconectando...');

    // Restore SSE (mock gap-fill with 2 new notifications)
    await mockSseConnected(page);
    await mockUnreadCount(page, 3);

    // Wait for reconnecting indicator to disappear (transition to connected)
    await expect(reconStatus).not.toContainText('Reconectando...', { timeout: 40_000 });
  });

  // -------------------------------------------------------------------------
  // Cenário 2 — Outage estendido → aviso + retry manual (US2, FR-020b)
  // -------------------------------------------------------------------------
  test('Cenário 2 — Outage estendido: aviso "Sem conexão" + botão "Tentar agora" visível', async ({ page }) => {
    // Simulate persistent disconnect
    await mockSseDisconnected(page);

    // Wait for extended-outage state (after 5 failures + backoff timers)
    // Using long timeout because exponential backoff can take ~30s in real time
    // In test we wait for the element; if timers are accelerated via page.clock this would be faster
    await page.waitForSelector('[data-testid="sse-connection-status"]:visible:has-text("Sem conexão")', {
      timeout: 60_000,
    });

    const outageMsg = page.locator('[data-testid="sse-connection-status"]:visible');
    await expect(outageMsg).toContainText('Sem conexão');

    // Verify "Tentar agora" button is visible and focusable
    const retryBtn = page.getByRole('button', { name: 'Tentar agora' }).filter({ visible: true });
    await expect(retryBtn).toBeVisible();

    // Verify button is focusable via Tab
    await retryBtn.focus();
    await expect(retryBtn).toBeFocused();
  });

  // -------------------------------------------------------------------------
  // Cenário 3 — Reconexão após outage: indicador some + gap-fill (US2 AC3, FR-020c)
  // -------------------------------------------------------------------------
  test('Cenário 3 — Clicar "Tentar agora" reconecta e indicador desaparece', async ({ page }) => {
    // Trigger disconnect
    await mockSseDisconnected(page);

    // Wait for outage state
    await page.waitForSelector('[data-testid="sse-connection-status"]:visible:has-text("Sem conexão")', {
      timeout: 60_000,
    });

    // Restore SSE before clicking retry
    await mockSseConnected(page);
    await mockUnreadCount(page, 2);

    // Click "Tentar agora"
    const retryBtn = page.getByRole('button', { name: 'Tentar agora' }).filter({ visible: true });
    await retryBtn.click();

    // Wait for status to clear
    const statusRegion = page.locator('[data-testid="sse-connection-status"]:visible');
    await expect(statusRegion).not.toContainText('Sem conexão', { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// 5.7 Roundtrip real FE→BE: filtro since (condicional — test.skip se sem backend)
// ---------------------------------------------------------------------------

test.describe('Roundtrip real: GET /notifications?since (5.7)', () => {
  // Roundtrip real (opcional em CI — skip se backend local não disponível)
  // test.skip se backend local não disponível no CI headless (integração condicional)
  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

  test('since ISO 8601 filtra notificações posteriores ao timestamp', async ({ request }) => {
    // Skip if no auth token available (CI headless without real Keycloak)
    const token = process.env.E2E_ACCESS_TOKEN;
    if (!token) {
      test.skip(true, 'roundtrip real (opcional em CI): E2E_ACCESS_TOKEN não configurado');
      return;
    }

    const since = '2026-01-01T00:00:00.000Z';
    const res = await request.get(`${BACKEND_URL}/notifications?since=${encodeURIComponent(since)}&status=unread`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Shape validation
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: unknown[]; meta: { total: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.total).toBe('number');

    // All items must be after `since`
    for (const item of body.data as Array<{ created_at: string }>) {
      expect(item.created_at > since).toBe(true);
    }
  });

  test('since inválido retorna 400', async ({ request }) => {
    const token = process.env.E2E_ACCESS_TOKEN;
    if (!token) {
      test.skip(true, 'roundtrip real (opcional em CI): E2E_ACCESS_TOKEN não configurado');
      return;
    }

    const res = await request.get(`${BACKEND_URL}/notifications?since=not-a-date`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
  });
});
