import { describe, it, expect } from 'vitest';
import { StubEmailHealthPort, EMAIL_HEALTH_PORT } from './email-health.port';

describe('StubEmailHealthPort', () => {
  it('isHealthy() always returns true', async () => {
    const stub = new StubEmailHealthPort();
    const result = await stub.isHealthy();
    expect(result).toBe(true);
  });

  it('isHealthy() is idempotent (multiple calls return true)', async () => {
    const stub = new StubEmailHealthPort();
    expect(await stub.isHealthy()).toBe(true);
    expect(await stub.isHealthy()).toBe(true);
    expect(await stub.isHealthy()).toBe(true);
  });

  it('EMAIL_HEALTH_PORT token is defined as a string', () => {
    expect(EMAIL_HEALTH_PORT).toBe('EMAIL_HEALTH_PORT');
  });

  it('implements EmailHealthPort interface (structural check)', async () => {
    const stub: import('./email-health.port').EmailHealthPort = new StubEmailHealthPort();
    // SC-07: callers depend on interface, not class
    const healthy = await stub.isHealthy();
    expect(typeof healthy).toBe('boolean');
  });
});
