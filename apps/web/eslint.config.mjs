import baseConfig from '@metanoia/config/eslint';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/.next/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/node_modules/**',
      // Playwright suite has its own tsconfig and runs via `playwright test`;
      // it depends on @playwright/test which is only available after install.
      'e2e/**',
      'playwright.config.ts',
    ],
  },
];
