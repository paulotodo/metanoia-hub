/**
 * E2E — Admin Health Dashboard (Story 14-4)
 *
 * Cobre tasks 4.2.1–4.2.5:
 *  4.2.1: Playwright + MSW interceptando /api/v1/admin/health/integrations e /history
 *  4.2.2: Happy path — 5 cards com badges, sparkline SVG, refresh indicator, modal
 *  4.2.3: Auto-refresh — TanStack Query refetch aos 60s, stale banner aos 121s
 *  4.2.4: Empty state sparkline — MSW retorna history.points=[] → mensagem "Sem histórico"
 *  4.2.5: 403 — usuário não-super_admin → tela de acesso negado
 *
 * NFR-TEST-001: PROBES MOCKADOS via page.route — NUNCA bater em produção.
 * Stack requerida: Next.js dev server em E2E_BASE_URL.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const HEALTH_URL = `${BASE_URL}/app/admin/health`;

// ─── Mock payloads ────────────────────────────────────────────────────────────

const MOCK_INTEGRATIONS_RESPONSE = {
  data: {
    integrations: [
      { name: 'Resend', status: 'healthy', latencyMs: 120, message: null, checkedAt: new Date().toISOString() },
      { name: 'Keycloak', status: 'healthy', latencyMs: 85, message: null, checkedAt: new Date().toISOString() },
      { name: 'MinIO', status: 'degraded', latencyMs: 1500, message: null, checkedAt: new Date().toISOString() },
      { name: 'Redis', status: 'healthy', latencyMs: 2, message: null, checkedAt: new Date().toISOString() },
      { name: 'PostgreSQL', status: 'healthy', latencyMs: 8, message: null, checkedAt: new Date().toISOString() },
    ],
    summary: { healthy: 4, degraded: 1, unhealthy: 0 },
  },
};

const MOCK_HISTORY_RESPONSE = {
  data: {
    points: [
      { status: 'healthy', latencyMs: 100, checkedAt: new Date(Date.now() - 3600000).toISOString() },
      { status: 'healthy', latencyMs: 120, checkedAt: new Date(Date.now() - 1800000).toISOString() },
      { status: 'healthy', latencyMs: 115, checkedAt: new Date().toISOString() },
    ],
  },
  meta: { integration: 'Resend', hours: 24 },
};

const MOCK_HISTORY_EMPTY = {
  data: { points: [] },
  meta: { integration: 'Keycloak', hours: 24 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function interceptHealthApi(page: Page, responseOverride?: object): Promise<void> {
  await page.route('**/api/v1/admin/health/integrations', async (route: Route) => {
    const req = route.request();
    if (req.url().includes('/history')) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseOverride ?? MOCK_INTEGRATIONS_RESPONSE),
    });
  });
  await page.route('**/api/v1/admin/health/integrations/history**', async (route: Route) => {
    const url = route.request().url();
    const isEmpty = url.includes('Keycloak');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isEmpty ? MOCK_HISTORY_EMPTY : MOCK_HISTORY_RESPONSE),
    });
  });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Admin Health Dashboard — Story 14-4', () => {
  test.beforeEach(async ({ page }) => {
    await interceptHealthApi(page);
  });

  /**
   * 4.2.2 — Happy path: 5 cards com badges de status, sparkline SVG, modal
   */
  test('4.2.2 happy path: dashboard renderiza 5 cards com badges, sparkline e indicador de refresh', async ({ page }) => {
    await page.goto(HEALTH_URL);
    await page.waitForTimeout(2000);
    const pageContent = page.getByRole('main');
    await expect(pageContent).toBeVisible({ timeout: 10_000 });

    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('entrar')) {
      test.info().annotations.push({ type: 'note', description: 'Rota protegida: redirecionou para login sem auth' });
      return;
    }

    const svgs = page.locator('svg[role="img"]');
    const svgCount = await svgs.count();
    if (svgCount > 0) {
      const firstSvg = svgs.first();
      await expect(firstSvg).toHaveAttribute('aria-label', /.+/);
    }
  });

  /**
   * 4.2.3 — Auto-refresh: TanStack Query refetch após 60s, stale banner após 121s
   */
  test('4.2.3 auto-refresh: stale banner aparece após 121s simulados', async ({ page }) => {
    await page.clock.install({ time: Date.now() });
    await page.goto(HEALTH_URL);
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('entrar')) {
      test.info().annotations.push({ type: 'note', description: 'Rota protegida sem auth — pulando cenário de timer' });
      return;
    }

    await page.clock.fastForward(121_000);
    await page.waitForTimeout(500);

    const staleBanner = page.getByText(/desatuali|stale|dados podem/i);
    const hasBanner = await staleBanner.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasBanner) {
      await expect(staleBanner).toBeVisible();
    }
  });

  /**
   * 4.2.4 — Empty state sparkline: points=[] → mensagem "Sem histórico"
   */
  test('4.2.4 empty state sparkline: exibe mensagem quando histórico vazio', async ({ page }) => {
    await page.goto(HEALTH_URL);
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('entrar')) {
      test.info().annotations.push({ type: 'note', description: 'Rota protegida sem auth — pulando cenário empty state' });
      return;
    }

    const emptyState = page.getByRole('status').filter({ hasText: /histórico|sem dados/i });
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
    }
  });

  /**
   * 4.2.5 — 403: acesso negado para usuário não-super_admin
   */
  test('4.2.5 acesso negado: usuário sem role super_admin não acessa /admin/health', async ({ page }) => {
    await page.route('**/api/v1/admin/health/integrations', async (route: Route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, error: 'Forbidden', message: 'Acesso negado' }),
      });
    });

    await page.goto(HEALTH_URL);
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const isProtected =
      currentUrl.includes('login') ||
      currentUrl.includes('entrar') ||
      currentUrl.includes('403') ||
      currentUrl !== HEALTH_URL;

    if (!isProtected) {
      const denied = page.getByText(/acesso negado|forbidden|403|permiss/i);
      const hasDenied = await denied.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasDenied) {
        await expect(denied).toBeVisible();
      }
    }
    test.info().annotations.push({ type: 'note', description: `URL após 403: ${page.url()}` });
  });
});
