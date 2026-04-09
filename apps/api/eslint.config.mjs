import baseConfig from '@metanoia/config/eslint';

export default [
  ...baseConfig,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**'],
  },
  // NestJS modules use empty classes with @Module() decorator — this is standard pattern
  {
    files: ['**/*.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  // Test files need relaxed rules for mocks and assertions
  {
    files: ['**/*.spec.ts', '**/*.integration-spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
