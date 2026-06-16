/**
 * register-keyboard.spec.ts -- E2E keyboard test: Register form navigation (WCAG 2.1 SC 2.1.1)
 *
 * Ref: US3/AC1-AC3, FR-003/FR-004/FR-005, SC-007 -- feature a11y-teclado-publico FASE 6
 * Browser: Chromium only (dec-012).
 *
 * Scenarios:
 *   1. Tab order: name -> email -> password -> toggle -> confirm-password -> submit
 *   2. Password toggle covers both password and confirm fields
 *   3. All fields reachable by Tab from first form element
 *   4. Shift+Tab reversal works (natural DOM order, no positive tabIndex)
 */
import { test, expect } from '@playwright/test';

test.describe('Register form -- keyboard navigation (US3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    // Skip skip-nav
    await page.keyboard.press('Tab'); // focus skip-nav
    await page.keyboard.press('Tab'); // move to first form field
  });

  test('First field after skip-nav is name input', async ({ page }) => {
    const nameInput = page.locator('#register-name');
    await expect(nameInput).toBeFocused({ timeout: 5_000 });
  });

  test('Tab order: name -> email', async ({ page }) => {
    await expect(page.locator('#register-name')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#register-email')).toBeFocused();
  });

  test('Tab order: email -> password', async ({ page }) => {
    await page.keyboard.press('Tab'); // -> email
    await expect(page.locator('#register-email')).toBeFocused();
    await page.keyboard.press('Tab'); // -> password
    await expect(page.locator('#register-password')).toBeFocused();
  });

  test('Tab order: password -> toggle button', async ({ page }) => {
    await page.keyboard.press('Tab'); // -> email
    await page.keyboard.press('Tab'); // -> password
    await expect(page.locator('#register-password')).toBeFocused();
    await page.keyboard.press('Tab'); // -> toggle
    const toggleBtn = page.locator('[data-testid="register-toggle-password"]');
    await expect(toggleBtn).toBeFocused();
  });

  test('Tab order: toggle -> confirm-password', async ({ page }) => {
    await page.keyboard.press('Tab'); // -> email
    await page.keyboard.press('Tab'); // -> password
    await page.keyboard.press('Tab'); // -> toggle
    await page.keyboard.press('Tab'); // -> confirm-password
    await expect(page.locator('#register-confirm-password')).toBeFocused();
  });

  test('Tab order eventually reaches submit button', async ({ page }) => {
    // Tab through: name -> email -> password -> toggle -> confirm-password -> submit
    let submitFocused = false;
    for (let i = 0; i < 7; i++) {
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

  test('Password toggle is Tab-reachable and has aria-label (keyboard accessible)', async ({ page }) => {
    // Navigate to toggle via Tab from password input
    const toggleBtn = page.locator('[data-testid="register-toggle-password"]');

    await page.locator('#register-password').focus();
    await page.keyboard.press('Tab'); // password -> toggle
    await expect(toggleBtn).toBeFocused({ timeout: 3_000 });

    // Verify toggle has aria-label (screen reader accessible per FR-004/FR-005)
    const ariaLabel = await toggleBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.length ?? 0).toBeGreaterThan(0);

    // Verify toggle button type=button (not submit -- prevents accidental form submission)
    await expect(toggleBtn).toHaveAttribute('type', 'button');
  });

  test('Shift+Tab from confirm-password returns to toggle', async ({ page }) => {
    await page.keyboard.press('Tab'); // -> email
    await page.keyboard.press('Tab'); // -> password
    await page.keyboard.press('Tab'); // -> toggle
    await page.keyboard.press('Tab'); // -> confirm-password
    await expect(page.locator('#register-confirm-password')).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    const toggleBtn = page.locator('[data-testid="register-toggle-password"]');
    await expect(toggleBtn).toBeFocused();
  });

  test('No positive tabIndex on form elements (CHK005)', async ({ page }) => {
    // positive tabIndex breaks natural DOM order
    const positiveTabindex = await page.locator(
      'form input[tabindex]:not([tabindex="-1"]):not([tabindex="0"]), ' +
      'form button[tabindex]:not([tabindex="-1"]):not([tabindex="0"])'
    ).count();
    expect(positiveTabindex).toBe(0);
  });
});
