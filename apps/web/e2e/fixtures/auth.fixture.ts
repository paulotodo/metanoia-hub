import { test as base, type Page } from '@playwright/test';
import { E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD } from '../setup/env';

/**
 * Reusable login helpers and Playwright fixtures.
 *
 * `loginAs(page, email, password)` performs a UI login against the public
 * `/login` page, mirroring exactly what an end-user does. Used both inline
 * in the happy-path spec (where login itself is an assertion) and by
 * fixtures that need an already-authenticated session.
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

interface AuthFixtures {
  adminPage: Page;
}

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ page }, use) => {
    await loginAs(page, E2E_DEMO_ADMIN_EMAIL, E2E_DEMO_PASSWORD);
    await page.waitForURL(/^\/(selecionar-igreja|app)(\/|$)/);
    await use(page);
  },
});

export { expect } from '@playwright/test';
