/**
 * Centralised env access for the E2E suite.
 *
 * Defaults match the local docker-compose stack; CI overrides via the
 * workflow env block. We fail fast in CI when an explicit value is missing
 * to avoid silent fall-through to a misleading default.
 */

const isCI = process.env.CI === 'true' || process.env.CI === '1';

function read(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (isCI) {
    throw new Error(`E2E env "${name}" is required in CI but was not provided`);
  }
  return fallback;
}

export const E2E_BASE_URL = read('E2E_BASE_URL', 'http://localhost:3000');
export const E2E_DEMO_PASSWORD = read('E2E_DEMO_PASSWORD', 'Demo!Pass2026');
export const E2E_DEMO_TENANT_ID = read(
  'E2E_DEMO_TENANT_ID',
  '019899a0-7002-7000-8000-000000000001',
);
export const E2E_DEMO_ADMIN_EMAIL = read(
  'E2E_DEMO_ADMIN_EMAIL',
  'admin@demo.metanoia.app',
);
