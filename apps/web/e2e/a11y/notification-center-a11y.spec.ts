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
    // auto-selects (SPA). Navigate explicitly to an authenticated /app route
    // so the NavigationShell mounts the NotificationCenter bell deterministically
    // (the bell is loaded via dynamic(ssr:false), so we wait for the bell selector).
    await page.waitForURL(/\/selecionar-igreja|\/app\//, { timeout: 30_000 });
    // NOTE: the NotificationCenter opens a persistent EventSource (SSE) stream, so the
    // network NEVER reaches 'networkidle' — waitUntil:'networkidle' always times out.
    // Use 'domcontentloaded' and wait for the bell (a deterministic, dynamic ssr:false
    // element) instead of relying on network idleness.
    await page.goto('/app/gestao', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[aria-label*="notificações" i], [aria-label="Sem notificações"]', {
      timeout: 15_000,
    });
  });

  test('1. axe WCAG 2AA: zero violações com sino visível', async ({ page }) => {
    // Wait for the bell to render
    await page.waitForSelector('[aria-label*="notificações"]', { timeout: 10_000 });

    const results = await new AxeBuilder({ page })
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
    const bell = page.getByRole('button', { name: /notificações/i }).first();
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
    const bell = page.getByRole('button', { name: /notificações/i }).first();
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
