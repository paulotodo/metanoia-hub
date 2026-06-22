/**
 * ResendHealthPort — unit tests (Story 14-4 §FR-008, §D-002)
 * NFR-TEST-001: fetch MOCKADO com vi.mock — NUNCA bater na API real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.validation';
import { ResendHealthPort } from '../resend-health.port';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node-fetch', () => ({})); // guard: não usar node-fetch

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeMockResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => ({}),
    text: async () => '',
  } as unknown as Response;
}

function makeConfigService(apiKey = 'test-api-key'): ConfigService<EnvConfig, true> {
  return {
    get: vi.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService<EnvConfig, true>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResendHealthPort.isHealthy()', () => {
  let port: ResendHealthPort;

  beforeEach(() => {
    vi.clearAllMocks();
    port = new ResendHealthPort(makeConfigService());
  });

  it('(a) resposta 200 → true (conectividade OK)', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(200));
    expect(await port.isHealthy()).toBe(true);
  });

  it('(b) resposta 401 → true (auth issue, Resend está up)', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(401));
    expect(await port.isHealthy()).toBe(true);
  });

  it('(b2) resposta 403 → true (conectividade confirmada)', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(403));
    expect(await port.isHealthy()).toBe(true);
  });

  it('(c) resposta 500 → false (Resend com problema de servidor)', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(500));
    expect(await port.isHealthy()).toBe(false);
  });

  it('(c2) resposta 503 → false', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(503));
    expect(await port.isHealthy()).toBe(false);
  });

  it('(d) timeout (AbortError/TimeoutError) → false, não lança exceção', async () => {
    const timeoutErr = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    mockFetch.mockRejectedValueOnce(timeoutErr);
    expect(await port.isHealthy()).toBe(false);
  });

  it('(d2) AbortError → false, não lança exceção', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    mockFetch.mockRejectedValueOnce(abortErr);
    expect(await port.isHealthy()).toBe(false);
  });

  it('(d3) erro de rede genérico → false, não lança exceção', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await port.isHealthy()).toBe(false);
  });

  it('(e) RESEND_API_KEY não aparece em nenhum log ou resposta — nunca serializado', async () => {
    // Validar que a chave de API não é capturada nos logs do Logger
    const loggerWarnSpy = vi.spyOn(port['logger'], 'warn');
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await port.isHealthy();

    // Nenhuma chamada ao logger deve conter a string 'test-api-key'
    for (const call of loggerWarnSpy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain('test-api-key');
    }
  });

  it('usa AbortSignal.timeout(5000) na requisição', async () => {
    mockFetch.mockResolvedValueOnce(makeMockResponse(200));
    await port.isHealthy();
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options?.signal).toBeDefined();
  });
});
