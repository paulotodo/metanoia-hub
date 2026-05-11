import baseConfig from '@metanoia/config/eslint';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/.next/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/node_modules/**',
    ],
  },
];
