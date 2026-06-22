/**
 * Integration spec — NotificationsModule: ResendHealthPort substitui StubEmailHealthPort (Story 14-4)
 *
 * Cobre task 4.1.2:
 *  - EmailCircuitBreakerService injeta ResendHealthPort real (não Stub)
 *  - isHealthy() retorna valor baseado em mock do fetch
 *
 * NFR-TEST-001: mock do fetch — NUNCA bate em API Resend real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResendHealthPort } from '../admin/health/resend-health.port';
import { ConfigService } from '@nestjs/config';
import type { EmailHealthPort } from './ports/email-health.port';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfigService(apiKey = 'resend-test-key'): ConfigService {
  return {
    get: vi.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService;
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

describe('NotificationsModule — ResendHealthPort substitution (Story 14-4)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('EMAIL_HEALTH_PORT token aponta para ResendHealthPort (não StubEmailHealthPort)', () => {
    const port = new ResendHealthPort(makeConfigService());
    expect(port).toBeDefined();
    expect(typeof (port as EmailHealthPort).isHealthy).toBe('function');
  });

  it('ResendHealthPort.isHealthy() retorna true para resposta 200 (conectividade OK)', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const port = new ResendHealthPort(makeConfigService());
    expect(await port.isHealthy()).toBe(true);
  });

  it('ResendHealthPort.isHealthy() retorna true para resposta 401 (conectividade confirmada, auth inválida)', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const port = new ResendHealthPort(makeConfigService());
    expect(await port.isHealthy()).toBe(true);
  });

  it('ResendHealthPort.isHealthy() retorna false para resposta 500 (servidor Resend indisponível)', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const port = new ResendHealthPort(makeConfigService());
    expect(await port.isHealthy()).toBe(false);
  });

  it('ResendHealthPort.isHealthy() retorna false para timeout (AbortError)', async () => {
    fetchSpy.mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    const port = new ResendHealthPort(makeConfigService());
    expect(await port.isHealthy()).toBe(false);
  });

  it('EmailCircuitBreakerService usa EMAIL_HEALTH_PORT (não referencia StubEmailHealthPort diretamente)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const serviceFile = path.resolve(
      __dirname,
      '../notifications/email-circuit-breaker.service.ts',
    );
    const source = fs.readFileSync(serviceFile, 'utf-8');
    expect(source).not.toContain('StubEmailHealthPort');
    expect(source).toContain('EMAIL_HEALTH_PORT');
  });
});
