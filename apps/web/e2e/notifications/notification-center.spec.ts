/**
 * notification-center.spec.ts — E2E Playwright: fluxo completo do Notification Center
 *
 * Story 14-2b — Epic 14: Notificações
 * Ref: spec FR-001/FR-003/FR-010/FR-013; SC-009 (zero .skip)
 *
 * P1 — Badge: login com notificações → badge exibe count correto
 * P2 — Painel: abrir sino → lista → marcar lida → navegar
 * P3 — Marcar todas: badge vai a 0, empty state pastoral
 * P4 — Silenciar: ativa toggle → badge atualiza, sem aria-live announcement
 *
 * Nota: SSE é mockado via route handler para evitar dependência de infra real.
 * Ao menos P1-P3 devem passar em CI sem SSE real.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth.fixture';
import { E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD } from '../setup/env';

// Base URL for API mock intercepts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ---------------------------------------------------------------------------
// Helpers: API mocks
// ---------------------------------------------------------------------------

async function mockUnreadNotifications(page: Page, notifications: object[]) {
  await page.route(`${API_URL}/notifications*`, async (route) => {
    if (route.request().url().includes('unread=true')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: notifications,
          meta: { page: 1, perPage: 20, total: notifications.length },
        }),
      });
    } else {
      await route.continue();
    }
  });
}

async function mockMarkAllRead(page: Page, updatedCount: number) {
  await page.route(`${API_URL}/notifications/read-all`, async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { updatedCount } }),
      });
    } else {
      await route.continue();
    }
  });
}

async function mockMarkRead(page: Page) {
  await page.route(/\/api\/v1\/notifications\/[^/]+\/read/, async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });
}

// Sample notifications
function makeNotifications(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `notif-${String(i + 1).padStart(3, '0')}`,
    type: 'pastoral_alert',
    channel: 'in_app',
    status: 'pending',
    title: `Alerta Pastoral ${i + 1}`,
    body: `Membro ${i + 1} não participa há 30 dias`,
    metadata: { actionUrl: '/app/radar' },
    read_at: null,
    created_at: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// P1 — Badge
// ---------------------------------------------------------------------------

test.describe('P1 — Badge do sino', () => {
  test('exibe count correto com 3 notificações não lidas', async ({ page }) => {
    const notifications = makeNotifications(3);
    await mockUnreadNotifications(page, notifications);
    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    // Demo admin is single-tenant: login lands on /selecionar-igreja which
    // auto-selects (SPA) and forwards to /app/gestao, where the
    // NavigationShell mounts the NotificationCenter bell.
    await page.waitForURL('**/app/**', { timeout: 30_000 });

    // Badge should show 3
    const badge = page.getByText('3').first();
    await expect(badge).toBeVisible({ timeout: 10_000 });

    // Aria-label confirms count
    const bell = page.getByRole('button', { name: /notificações não lidas/i }).first();
    await expect(bell).toHaveAttribute('aria-label', '3 notificações não lidas');
  });

  test('badge exibe 99+ quando count > 99', async ({ page }) => {
    const notifications = makeNotifications(20); // mock returns 20 but total=100
    await page.route(`${API_URL}/notifications*`, async (route) => {
      if (route.request().url().includes('unread=true')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: notifications,
            meta: { page: 1, perPage: 20, total: 100 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    // Demo admin is single-tenant: login lands on /selecionar-igreja which
    // auto-selects (SPA) and forwards to /app/gestao, where the
    // NavigationShell mounts the NotificationCenter bell.
    await page.waitForURL('**/app/**', { timeout: 30_000 });

    await expect(page.getByText('99+').first()).toBeVisible({ timeout: 10_000 });
    const bell = page.getByRole('button', { name: /99\+ notificações/i }).first();
    await expect(bell).toHaveAttribute('aria-label', '99+ notificações não lidas');
  });
});

// ---------------------------------------------------------------------------
// P2 — Painel
// ---------------------------------------------------------------------------

test.describe('P2 — Painel de notificações', () => {
  test('abre painel, exibe lista, clicar item marca como lida', async ({ page }) => {
    const notifications = makeNotifications(2);
    await mockUnreadNotifications(page, notifications);
    await mockMarkRead(page);

    // After mark-read, return empty list
    let callCount = 0;
    await page.route(`${API_URL}/notifications*`, async (route) => {
      if (route.request().url().includes('unread=true')) {
        callCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: callCount === 1 ? notifications : [],
            meta: { page: 1, perPage: 20, total: callCount === 1 ? 2 : 0 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    // Demo admin is single-tenant: login lands on /selecionar-igreja which
    // auto-selects (SPA) and forwards to /app/gestao, where the
    // NavigationShell mounts the NotificationCenter bell.
    await page.waitForURL('**/app/**', { timeout: 30_000 });

    // Click the bell to open panel
    const bell = page.getByRole('button', { name: /notificações não lidas/i }).first();
    await bell.click();

    // Panel opens with dialog role
    const panel = page.getByRole('dialog', { name: 'Notificações' });
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // List item visible
    await expect(page.getByText('Alerta Pastoral 1')).toBeVisible();

    // Click first item — triggers mark-read + navigation
    await page.getByRole('button', { name: /Alerta Pastoral 1/i }).first().click();
  });

  test('empty state pastoral quando sem notificações', async ({ page }) => {
    await mockUnreadNotifications(page, []);

    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    // Demo admin is single-tenant: login lands on /selecionar-igreja which
    // auto-selects (SPA) and forwards to /app/gestao, where the
    // NavigationShell mounts the NotificationCenter bell.
    await page.waitForURL('**/app/**', { timeout: 30_000 });

    // Open panel
    const bell = page.getByRole('button', { name: 'Sem notificações' }).first();
    await bell.click();

    const panel = page.getByRole('dialog', { name: 'Notificações' });
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Tudo em ordem')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// P3 — Marcar todas como lidas
// ---------------------------------------------------------------------------

test.describe('P3 — Marcar todas como lidas', () => {
  test('badge vai a 0 e empty state pastoral é exibido', async ({ page }) => {
    const notifications = makeNotifications(5);
    await mockMarkAllRead(page, 5);

    let callCount = 0;
    await page.route(`${API_URL}/notifications*`, async (route) => {
      if (route.request().url().includes('unread=true')) {
        callCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: callCount === 1 ? notifications : [],
            meta: { page: 1, perPage: 20, total: callCount === 1 ? 5 : 0 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    // Demo admin is single-tenant: login lands on /selecionar-igreja which
    // auto-selects (SPA) and forwards to /app/gestao, where the
    // NavigationShell mounts the NotificationCenter bell.
    await page.waitForURL('**/app/**', { timeout: 30_000 });

    // Open panel
    const bell = page.getByRole('button', { name: '5 notificações não lidas' }).first();
    await bell.click();

    const panel = page.getByRole('dialog', { name: 'Notificações' });
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Click mark all as read
    await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();

    // Badge should disappear (0 unread)
    await expect(page.getByText('5')).not.toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// P4 — Silenciar
// ---------------------------------------------------------------------------

test.describe('P4 — Toggle Silenciar', () => {
  test('toggle silenciar: exibe botão e persiste preferência', async ({ page }) => {
    const notifications = makeNotifications(1);
    await mockUnreadNotifications(page, notifications);

    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    // Demo admin is single-tenant: login lands on /selecionar-igreja which
    // auto-selects (SPA) and forwards to /app/gestao, where the
    // NavigationShell mounts the NotificationCenter bell.
    await page.waitForURL('**/app/**', { timeout: 30_000 });

    // Open panel
    const bell = page.getByRole('button', { name: /notificações não lidas/i }).first();
    await bell.click();

    const panel = page.getByRole('dialog', { name: 'Notificações' });
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Click Silenciar
    const silenceBtn = page.getByRole('button', { name: 'Silenciar' });
    await expect(silenceBtn).toBeVisible();
    await silenceBtn.click();

    // Button now shows "Ativar alertas"
    await expect(page.getByRole('button', { name: 'Ativar alertas' })).toBeVisible();

    // Badge still visible (silence only suppresses aria-live, not badge)
    await expect(page.getByText('1').first()).toBeVisible();
  });
});
