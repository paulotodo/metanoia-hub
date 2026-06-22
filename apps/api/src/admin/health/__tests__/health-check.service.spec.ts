/**
 * HealthCheckService — unit tests (Story 14-4 §FR-002, §NFR-I5, §D-002)
 * NFR-TEST-001: TODAS as dependências mockadas — NUNCA bater em produção.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.validation';
import { HealthCheckService } from '../health-check.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { RedisService } from '../../../redis/redis.service';

// ---------------------------------------------------------------------------
// Mocks globais
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeConfigService(overrides: Record<string, string> = {}): ConfigService<EnvConfig, true> {
  const defaults: Record<string, string> = {
    RESEND_API_KEY: 'test-resend-key',
    KEYCLOAK_URL: 'http://keycloak-mock',
    KEYCLOAK_REALM: 'metanoia',
    MINIO_ENDPOINT: 'http://minio-mock',
  };
  return { get: vi.fn((k: string) => overrides[k] ?? defaults[k]) } as unknown as ConfigService<EnvConfig, true>;
}

function makeResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as unknown as Response;
}

/** Simula latência: resolve após N ms */
function _delayedResolve<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function makeService(redisPing = vi.fn().mockResolvedValue('PONG'), pgQuery = vi.fn().mockResolvedValue([{ '?column?': 1 }])) {
  const configService = makeConfigService();
  const prisma = { $queryRaw: pgQuery } as unknown as PrismaService;
  const redis = { ping: redisPing } as unknown as RedisService;
  return new HealthCheckService(configService, prisma, redis);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthCheckService.runAllProbes()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a) todas probes healthy → summary correto', async () => {
    mockFetch
      .mockResolvedValue(makeResponse(200)); // Resend + Keycloak + MinIO

    const service = makeService();
    const probePromise = service.runAllProbes();
    vi.runAllTimersAsync();
    const items = await probePromise;

    expect(items).toHaveLength(5);
    const names = items.map((i) => i.name);
    expect(names).toContain('Resend');
    expect(names).toContain('Keycloak');
    expect(names).toContain('MinIO');
    expect(names).toContain('Redis');
    expect(names).toContain('PostgreSQL');

    const summary = service.computeSummary(items);
    expect(summary.total).toBe(5);
    expect(summary.unhealthy).toBe(0);
  });

  it('(b) boundary latência: 999ms → healthy', async () => {
    mockFetch.mockResolvedValue(makeResponse(200));
    const service = makeService();

    // Verificar classificação direta
    // Testar via resultado: injetar spy de performance.now para controlar latência
    const perfSpy = vi.spyOn(performance, 'now');
    perfSpy.mockReturnValueOnce(0).mockReturnValueOnce(999); // 999ms

    mockFetch.mockResolvedValueOnce(makeResponse(200));
    const item = await (service as unknown as { probeResend: (s: string) => Promise<unknown> })['probeResend'](new Date().toISOString());
    expect((item as { status: string }).status).toBe('healthy');
  });

  it('(c) probe Resend unhealthy (timeout simulado)', async () => {
    const timeoutErr = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    mockFetch.mockRejectedValueOnce(timeoutErr); // Resend timeout
    mockFetch.mockResolvedValue(makeResponse(200)); // outros OK

    const service = makeService();
    vi.runAllTimersAsync();
    const items = await service.runAllProbes();

    const resend = items.find((i) => i.name === 'Resend');
    expect(resend?.status).toBe('unhealthy');
    expect(resend?.message).toBe('timeout');
    expect(resend?.latencyMs).toBeNull();
  });

  it('(d) boundary latência 1001ms → degraded', async () => {
    const perfSpy = vi.spyOn(performance, 'now');
    perfSpy.mockReturnValueOnce(0).mockReturnValueOnce(1001);
    mockFetch.mockResolvedValueOnce(makeResponse(200));

    const service = makeService();
    const item = await (service as unknown as { probeResend: (s: string) => Promise<unknown> })['probeResend'](new Date().toISOString());
    expect((item as { status: string }).status).toBe('degraded');
  });

  it('(d2) boundary latência 5001ms → unhealthy', async () => {
    const perfSpy = vi.spyOn(performance, 'now');
    perfSpy.mockReturnValueOnce(0).mockReturnValueOnce(5001);
    mockFetch.mockResolvedValueOnce(makeResponse(200));

    const service = makeService();
    const item = await (service as unknown as { probeResend: (s: string) => Promise<unknown> })['probeResend'](new Date().toISOString());
    expect((item as { status: string }).status).toBe('unhealthy');
  });

  it('(e) erro de rede em qualquer probe → unhealthy, message da allowlist, sem stack trace', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const service = makeService(
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );
    vi.runAllTimersAsync();
    const items = await service.runAllProbes();

    for (const item of items) {
      expect(item.status).toBe('unhealthy');
      // message deve ser da allowlist canônica, nunca stack trace
      if (item.message) {
        expect(['timeout', 'connection refused', 'api key invalid — connectivity confirmed', 'unknown error']).toContain(item.message);
        expect(item.message).not.toContain('Error:');
        expect(item.message).not.toContain('at ');
      }
    }
  });

  it('(f) KEYCLOAK_URL, MINIO_ENDPOINT, RESEND_API_KEY não aparecem em message', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = makeService(
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );
    vi.runAllTimersAsync();
    const items = await service.runAllProbes();

    for (const item of items) {
      const msg = item.message ?? '';
      expect(msg).not.toContain('http://keycloak-mock');
      expect(msg).not.toContain('http://minio-mock');
      expect(msg).not.toContain('test-resend-key');
    }
  });
});

describe('HealthCheckService.computeSummary()', () => {
  it('calcula summary corretamente', () => {
    const service = makeService();
    const items = [
      { name: 'Redis', status: 'healthy' as const, latencyMs: 2, lastChecked: '' },
      { name: 'Resend', status: 'degraded' as const, latencyMs: 2000, lastChecked: '' },
      { name: 'MinIO', status: 'unhealthy' as const, latencyMs: null, lastChecked: '' },
      { name: 'Keycloak', status: 'healthy' as const, latencyMs: 50, lastChecked: '' },
      { name: 'PostgreSQL', status: 'unhealthy' as const, latencyMs: null, lastChecked: '' },
    ];
    const summary = service.computeSummary(items);
    expect(summary).toEqual({ total: 5, healthy: 2, degraded: 1, unhealthy: 2 });
  });
});
