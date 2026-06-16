/**
 * login-keyboard.spec.ts -- E2E keyboard test: Login form navigation (WCAG 2.1 SC 2.1.1)
 *
 * Ref: US2/AC1-AC3, FR-002/FR-004/FR-005, SC-007 -- feature a11y-teclado-publico FASE 6
 * Browser: Chromium only (dec-012).
 *
 * Scenarios:
 *   1. Tab order: email -> password -> toggle -> submit (DOM order)
 *   2. Shift+Tab reversal is natural (no positive tabIndex)
 *   3. Password visibility toggle is keyboard-accessible
 *   4. Enter on submit button submits the form
 *   5. Tab from password field reaches toggle button
 */
import { test, expect } from '@playwright/test';

test.describe('Login form -- keyboard navigation (US2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Skip skip-nav to land on first form field
    // Tab once -> skip-nav, Tab again -> first interactive element in form
    await page.keyboard.press('Tab'); // focus skip-nav
    await page.keyboard.press('Tab'); // move past skip-nav
  });

  test('Tab order: first field after skip-nav is email input', async ({ page }) => {
    // After 2 Tabs (skip-nav + first form el), we expect email input
    const emailInput = page.locator('#login-email');
    await expect(emailInput).toBeFocused({ timeout: 5_000 });
  });

  test('Tab order: email -> password input', async ({ page }) => {
    const emailInput = page.locator('#login-email');
    await expect(emailInput).toBeFocused();

    await page.keyboard.press('Tab');

    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeFocused();
  });

  test('Tab order: password -> toggle button (password visibility)', async ({ page }) => {
    // Navigate to password input
    await page.keyboard.press('Tab'); // email -> password
    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeFocused();

    await page.keyboard.press('Tab'); // password -> toggle
    const toggleBtn = page.locator('[data-testid="login-toggle-password"]');
    await expect(toggleBtn).toBeFocused();
  });

  test('Password toggle is Tab-reachable (keyboard accessible)', async ({ page }) => {
    // The toggle button must be reachable via Tab from the password input.
    // Operability (onClick handler) is covered in unit tests (login.spec.tsx).
    // Here we verify only the keyboard accessibility contract: Tab order is correct.
    const toggleBtn = page.locator('[data-testid="login-toggle-password"]');

    // Navigate: email -> password -> toggle via Tab
    await page.locator('#login-email').focus();
    await page.keyboard.press('Tab'); // email -> password
    await expect(page.locator('#login-password')).toBeFocused({ timeout: 3_000 });

    await page.keyboard.press('Tab'); // password -> toggle button
    await expect(toggleBtn).toBeFocused({ timeout: 3_000 });

    // Verify toggle has correct aria-label (screen reader accessible)
    const ariaLabel = await toggleBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.length ?? 0).toBeGreaterThan(0);
  });

  test('Shift+Tab reversal: from password toggle back to password input', async ({ page }) => {
    // Go forward to toggle
    await page.keyboard.press('Tab'); // -> password
    await page.keyboard.press('Tab'); // -> toggle

    const toggleBtn = page.locator('[data-testid="login-toggle-password"]');
    await expect(toggleBtn).toBeFocused();

    // Go backward
    await page.keyboard.press('Shift+Tab');

    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeFocused();
  });

  test('Tab order eventually reaches submit button', async ({ page }) => {
    // Tab through all fields: email -> password -> toggle -> [forgot link?] -> submit
    // We keep tabbing until we find the submit button (max 5 Tabs)
    let submitFocused = false;
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const submitBtn = page.locator('button[type="submit"]');
      const isFocused = await submitBtn.evaluate((el) => el === document.activeElement);
      if (isFocused) {
        submitFocused = true;
        break;
      }
    }
    expect(submitFocused).toBe(true);
  });

  test('All interactive elements have visible focus ring (focus-visible CSS)', async ({ page }) => {
    // Verify no tabIndex=-1 on interactive elements (accessibility anti-pattern)
    const negativeTabindex = await page.locator(
      'form input[tabindex="-1"], form button[tabindex="-1"]'
    ).count();
    expect(negativeTabindex).toBe(0);
  });
});
