import type { Page } from '@playwright/test';

/**
 * Reusable login helper for the E2E suite.
 *
 * `loginAs(page, email, password)` performs a UI login against the public
 * `/login` page, mirroring exactly what an end-user does. Specs that need
 * an already-authenticated session call this from `beforeEach`.
 */

export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
}

export { test, expect } from '@playwright/test';
