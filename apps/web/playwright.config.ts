import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // Test file globs:
  //   **/*.spec.ts        - standard Playwright pattern (axe-baseline, keyboard/*)
  //   **/a11y/*.e2e-spec.ts - a11y specs (contrast-focus, reduced-motion, touch-targets)
  // Note: tests/*.e2e-spec.ts uses legacy fixture syntax; run them individually.
  testMatch: ['**/*.spec.ts', '**/a11y/*.e2e-spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : 'list',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // mobile-a11y: Chromium emulation for touch target validation (Story 12.4)
    // CRITICAL (CHK033/dec-023): uses devices['Pixel 5'] (Mobile Chrome / Chromium).
    // NEVER use devices['iPhone 12'] (WebKit) -- CI is Chromium-only.
    // Tests: e2e/a11y/touch-targets.e2e-spec.ts
    // Ref: tasks.md T.2, spec.md FR-1, dec-019, dec-023
    {
      name: 'mobile-a11y',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/e2e/a11y/touch-targets.e2e-spec.ts',
    },
  ],
});
