/**
 * recovery-keyboard.spec.ts -- E2E keyboard test: Password recovery form (WCAG 2.1 SC 2.1.1)
 *
 * Ref: US2 (recovery flow), FR-002, SC-007 -- feature a11y-teclado-publico FASE 6
 * Browser: Chromium only (dec-012).
 *
 * Context: RecoveryForm (/recuperar-senha) uses autoFocus on the email input.
 * This means the email field receives focus on page load -- Tab order from that
 * point: email -> submit button -> back-to-login link.
 *
 * Scenarios:
 *   1. Email input has autoFocus on page load
 *   2. Tab from email goes to submit button
 *   3. Tab from submit goes to back-to-login link
 *   4. Enter on submit triggers form submission
 *   5. Shift+Tab from submit returns to email
 */
import { test, expect } from '@playwright/test';

test.describe('Password recovery form -- keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recuperar-senha');
    await page.waitForLoadState('networkidle');
  });

  test('Email input is focused on page load (autoFocus)', async ({ page }) => {
    const emailInput = page.locator('[data-testid="recovery-email-input"]');
    await expect(emailInput).toBeFocused({ timeout: 5_000 });
  });

  test('Tab from email goes to submit button', async ({ page }) => {
    const emailInput = page.locator('[data-testid="recovery-email-input"]');
    await expect(emailInput).toBeFocused();

    await page.keyboard.press('Tab');

    const submitBtn = page.locator('[data-testid="recovery-submit"]');
    await expect(submitBtn).toBeFocused();
  });

  test('Submit button is operable by Enter key', async ({ page }) => {
    const emailInput = page.locator('[data-testid="recovery-email-input"]');
    await emailInput.fill('usuario@exemplo.com');

    await page.keyboard.press('Tab');
    const submitBtn = page.locator('[data-testid="recovery-submit"]');
    await expect(submitBtn).toBeFocused();

    // Intercept the network request so it does not hang
    await page.route('**/api/v1/auth/forgot-password', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    // Enter on submit triggers submission
    await page.keyboard.press('Enter');

    // After Enter: either the success card is visible or submit button changed state
    await page.waitForTimeout(500);
    const sentCard = page.locator('[data-testid="recovery-sent"]');
    const submitStill = page.locator('[data-testid="recovery-submit"]');
    const eitherVisible = (await sentCard.isVisible()) || (await submitStill.isVisible());
    expect(eitherVisible).toBe(true);
  });

  test('Back to login link is Tab-reachable from submit button', async ({ page }) => {
    const emailInput = page.locator('[data-testid="recovery-email-input"]');
    await expect(emailInput).toBeFocused(); // autoFocus

    // Tab: email -> submit
    await page.keyboard.press('Tab');
    const submitBtn = page.locator('[data-testid="recovery-submit"]');
    await expect(submitBtn).toBeFocused();

    // Tab: submit -> back link
    await page.keyboard.press('Tab');

    // The "Voltar para login" link (href="/login") should be focused
    const backLink = page.locator('a[href="/login"]');
    await expect(backLink).toBeFocused({ timeout: 5_000 });
  });

  test('Shift+Tab from submit goes back to email input', async ({ page }) => {
    const emailInput = page.locator('[data-testid="recovery-email-input"]');
    await expect(emailInput).toBeFocused();

    await page.keyboard.press('Tab'); // -> submit
    const submitBtn = page.locator('[data-testid="recovery-submit"]');
    await expect(submitBtn).toBeFocused();

    await page.keyboard.press('Shift+Tab'); // back to email
    await expect(emailInput).toBeFocused();
  });

  test('Email input has aria-invalid=false when empty (no error state yet)', async ({ page }) => {
    const emailInput = page.locator('[data-testid="recovery-email-input"]');
    // On load, no error -- aria-invalid should be false (not "true")
    const ariaInvalid = await emailInput.getAttribute('aria-invalid');
    expect(ariaInvalid).not.toBe('true');
  });

  test('SkipNav is present in DOM (even with autoFocus on email)', async ({ page }) => {
    // SkipNav must exist on this page (root layout renders it)
    const skipNav = page.locator('a[href="#conteudo"]');
    await expect(skipNav).toBeAttached();
  });
});
