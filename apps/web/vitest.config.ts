import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror tsconfig paths so tests can import from the `@/` alias.
      '@': path.resolve(__dirname, './src'),
      '@mocks': path.resolve(__dirname, './__mocks__'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['app/**/*.spec.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
