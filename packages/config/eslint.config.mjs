import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const noSurveillanceTerms = require('./eslint/no-surveillance-terms.js');

/** Plugin com a regra pastoral de vocabulário */
const metanoiaPlugin = {
  rules: {
    'no-surveillance-terms': noSurveillanceTerms,
  },
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettierConfig,
  {
    plugins: {
      '@metanoia': metanoiaPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Bloqueia termos de vigilância em strings literais user-facing.
      // Aceita strings em className/class (Tailwind CSS) e imports técnicos.
      // @see packages/types/src/vocabulary/vocabulary.ts
      '@metanoia/no-surveillance-terms': 'error',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', '**/.turbo/**'],
  },
);
