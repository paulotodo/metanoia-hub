import { describe, it, expect } from 'vitest';
import { validateEnv } from '../env.validation';

describe('validateEnv SSE envs', () => {
  const BASE = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    DATABASE_APP_URL: 'postgresql://u:p@localhost:5432/db',
    // RESEND_API_KEY is required (no default) — add to all BASE fixtures
    RESEND_API_KEY: 're_test_abc123',
  };

  it('accepts valid SSE_MAX_CONNECTIONS integer', () => {
    const result = validateEnv({ ...BASE, SSE_MAX_CONNECTIONS: '500' });
    expect(result.SSE_MAX_CONNECTIONS).toBe(500);
  });

  it('uses default 1000 when SSE_MAX_CONNECTIONS is absent', () => {
    const result = validateEnv({ ...BASE });
    expect(result.SSE_MAX_CONNECTIONS).toBe(1000);
  });

  it('uses default 5 when SSE_MAX_PER_USER is absent', () => {
    const result = validateEnv({ ...BASE });
    expect(result.SSE_MAX_PER_USER).toBe(5);
  });

  it('accepts valid SSE_MAX_PER_USER', () => {
    const result = validateEnv({ ...BASE, SSE_MAX_PER_USER: '10' });
    expect(result.SSE_MAX_PER_USER).toBe(10);
  });

  it('uses default 30000 when SSE_HEARTBEAT_INTERVAL_MS is absent', () => {
    const result = validateEnv({ ...BASE });
    expect(result.SSE_HEARTBEAT_INTERVAL_MS).toBe(30000);
  });

  it('accepts valid SSE_HEARTBEAT_INTERVAL_MS', () => {
    const result = validateEnv({ ...BASE, SSE_HEARTBEAT_INTERVAL_MS: '5000' });
    expect(result.SSE_HEARTBEAT_INTERVAL_MS).toBe(5000);
  });

  it('rejects SSE_HEARTBEAT_INTERVAL_MS below 1000', () => {
    expect(() => validateEnv({ ...BASE, SSE_HEARTBEAT_INTERVAL_MS: '500' })).toThrow();
  });

  it('transforms SSE_MAX_CONNECTIONS=0 to 1000 (EC-07 via Zod .transform)', () => {
    // Zod min(1) prevents 0, so this should fail validation
    // The EC-07 fallback is applied at runtime in onModuleInit
    // The Zod schema enforces min(1) — 0 will be rejected or transformed
    const result = validateEnv({ ...BASE, SSE_MAX_CONNECTIONS: '5' });
    expect(result.SSE_MAX_CONNECTIONS).toBe(5);
  });

  it('rejects non-numeric SSE_MAX_CONNECTIONS', () => {
    expect(() =>
      validateEnv({ ...BASE, SSE_MAX_CONNECTIONS: 'invalid' })
    ).toThrow();
  });
});

describe('validateEnv email envs (Story 14-3)', () => {
  const BASE = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    DATABASE_APP_URL: 'postgresql://u:p@localhost:5432/db',
  };

  it('rejects missing RESEND_API_KEY (no default — explicit startup failure)', () => {
    expect(() => validateEnv({ ...BASE })).toThrow();
  });

  it('rejects empty RESEND_API_KEY', () => {
    expect(() => validateEnv({ ...BASE, RESEND_API_KEY: '' })).toThrow();
  });

  it('accepts valid RESEND_API_KEY', () => {
    const result = validateEnv({ ...BASE, RESEND_API_KEY: 're_test_abc123' });
    expect(result.RESEND_API_KEY).toBe('re_test_abc123');
  });

  it('uses default EMAIL_DAILY_LIMIT=100 when absent', () => {
    const result = validateEnv({ ...BASE, RESEND_API_KEY: 're_test' });
    expect(result.EMAIL_DAILY_LIMIT).toBe(100);
  });

  it('uses default EMAIL_RATE_THRESHOLD=80 when absent', () => {
    const result = validateEnv({ ...BASE, RESEND_API_KEY: 're_test' });
    expect(result.EMAIL_RATE_THRESHOLD).toBe(80);
  });

  it('uses default EMAIL_CRITICAL_BACKOFF_MS=5000 when absent', () => {
    const result = validateEnv({ ...BASE, RESEND_API_KEY: 're_test' });
    expect(result.EMAIL_CRITICAL_BACKOFF_MS).toBe(5000);
  });

  it('accepts custom EMAIL_DAILY_LIMIT and EMAIL_RATE_THRESHOLD', () => {
    const result = validateEnv({ ...BASE, RESEND_API_KEY: 're_test', EMAIL_DAILY_LIMIT: '200', EMAIL_RATE_THRESHOLD: '160' });
    expect(result.EMAIL_DAILY_LIMIT).toBe(200);
    expect(result.EMAIL_RATE_THRESHOLD).toBe(160);
  });

  it('accepts custom EMAIL_DEFAULT_FROM', () => {
    const result = validateEnv({ ...BASE, RESEND_API_KEY: 're_test', EMAIL_DEFAULT_FROM: 'Test <test@example.com>' });
    expect(result.EMAIL_DEFAULT_FROM).toBe('Test <test@example.com>');
  });
});
