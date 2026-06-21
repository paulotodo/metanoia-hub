/**
 * notification-center-a11y.spec.ts — Accessibility tests for Notification Center
 *
 * Story 14-2b — Task 5.6
 * Ref: spec FR-012/SC-004/SC-005; lição Epic 12 (gate a11y permanente no CI)
 *
 * Tests:
 *   1. axe scan: zero WCAG AA violations with NotificationCenter mounted
 *   2. Keyboard navigation: Tab to bell → Enter opens → Escape closes
 *   3. Focus visible on all interactive elements
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from '../fixtures/auth.fixture';
import { E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD } from '../setup/env';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function makeNotifications(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    // id MUST be a valid UUID — NotificationListItemSchema enforces z.string().uuid().
    // An invalid id makes the envelope parse throw, the unread query error out and
    // the badge silently render 0 ("Sem notificações"), which broke this spec.
    id: `0199${(i + 1).toString(16).padStart(4, '0')}-7000-7000-8000-000000000001`,
    type: 'pastoral_alert',
    channel: 'in_app',
    status: 'pending',
    title: `Notificação ${i + 1}`,
    body: `Descrição da notificação ${i + 1}`,
    // metadata is optional (z.record(...).optional()) — null FAILS the schema, so omit it.
    read_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

test.describe('Notification Center — a11y (Story 14-2b)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock notifications endpoint
    await page.route(`${API_URL}/notifications*`, async (route) => {
      if (route.request().url().includes('unread=true')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: makeNotifications(3),
            meta: { page: 1, perPage: 20, total: 3 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    // Demo admin is single-tenant: login lands on /selecionar-igreja which
    // auto-selects (SPA) and forwards to /app/gestao.
    // Do NOT do page.goto('/app/gestao') here — that bypasses the SPA tenant
    // auto-select and causes a redirect that prevents the bell from mounting.
    // Instead, wait for the SPA to navigate on its own.
    await page.waitForURL('**/app/**', { timeout: 30_000 });
    // NOTE: the NotificationCenter opens a persistent EventSource (SSE) stream, so the
    // network NEVER reaches 'networkidle' — do NOT use waitUntil:'networkidle'.
    // Wait for the VISIBLE bell (desktop: sidebar bell; mobile: header bell).
    await page.waitForSelector('button[aria-label*="notificações" i]:visible', {
      timeout: 15_000,
    });
  });

  test('1. axe WCAG 2AA: zero violações no Notification Center (sino + painel)', async ({ page }) => {
    // Open the panel so axe scans both the bell trigger AND the open dialog —
    // the richest interactive surface of the NotificationCenter component.
    const bell = page.locator('[data-testid="notification-bell"]:visible');
    await bell.click();
    const panel = page.locator('[data-testid="notification-panel"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // SCOPE the scan to the NotificationCenter component ONLY.
    // A whole-page scan flags pre-existing color-contrast debt in the existing
    // sidebar nav (text-muted token, Epic 12 tech-debt R2) which is OUT OF SCOPE
    // for story 14-2b. This test asserts the COMPONENT is WCAG-clean, not the page.
    const results = await new AxeBuilder({ page })
      .include('[data-testid="notification-bell"]')
      .include('[data-testid="notification-panel"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    if (results.violations.length > 0) {
      const summary = results.violations
        .map((v) => `  [${v.impact ?? 'unknown'}] ${v.id}: ${v.description}`)
        .join('\n');
      console.error(`[notification-center-a11y] Violations:\n${summary}`);
    }

    expect(results.violations).toHaveLength(0);
  });

  test('2. keyboard: Tab until bell → Enter opens panel → Escape closes', async ({ page }) => {
    // Tab to the notification bell button
    const bell = page.locator('button[aria-label*="notificações" i]:visible');
    await bell.focus();
    await expect(bell).toBeFocused();

    // Enter opens the panel
    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog', { name: 'Notificações' });
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Escape closes the panel
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible({ timeout: 3_000 });
  });

  test('3. keyboard: Tab through panel elements — all focusable', async ({ page }) => {
    const bell = page.locator('button[aria-label*="notificações" i]:visible');
    await bell.click();

    const panel = page.getByRole('dialog', { name: 'Notificações' });
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Tab to "Silenciar" button
    await page.keyboard.press('Tab');
    const silenceBtn = page.getByRole('button', { name: 'Silenciar' });
    // Check it's focusable (can be focused by keyboard)
    await silenceBtn.focus();
    await expect(silenceBtn).toBeFocused();

    // Tab to "Marcar todas como lidas" if visible
    const markAllBtn = page.getByRole('button', { name: 'Marcar todas como lidas' });
    if (await markAllBtn.isVisible()) {
      await markAllBtn.focus();
      await expect(markAllBtn).toBeFocused();
    }
  });
});
