/**
 * HealthCheckController — unit tests (Story 14-4 §FR-003, §FR-004, §NFR-SEC-002)
 * NFR-TEST-001: probes MOCKADAS — NUNCA bater em produção.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckController } from '../health-check.controller';
import type { HealthCheckService } from '../health-check.service';
import type { AuditService } from '../../../audit/audit.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { IntegrationHealthItem, IntegrationHealthSummary } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockIntegrations: IntegrationHealthItem[] = [
  { name: 'Resend', status: 'healthy', latencyMs: 100, lastChecked: '2026-06-22T04:00:00Z' },
  { name: 'Keycloak', status: 'healthy', latencyMs: 50, lastChecked: '2026-06-22T04:00:00Z' },
  { name: 'MinIO', status: 'degraded', latencyMs: 2000, lastChecked: '2026-06-22T04:00:00Z' },
  { name: 'Redis', status: 'healthy', latencyMs: 2, lastChecked: '2026-06-22T04:00:00Z' },
  { name: 'PostgreSQL', status: 'healthy', latencyMs: 10, lastChecked: '2026-06-22T04:00:00Z' },
];

const mockSummary: IntegrationHealthSummary = { total: 5, healthy: 4, degraded: 1, unhealthy: 0 };

function makeController() {
  const healthCheckService = {
    runAllProbes: vi.fn().mockResolvedValue(mockIntegrations),
    computeSummary: vi.fn().mockReturnValue(mockSummary),
  } as unknown as HealthCheckService;

  const auditService = {
    createEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const prisma = {
    client: {
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;

  const controller = new HealthCheckController(healthCheckService, auditService, prisma);
  return { controller, healthCheckService, auditService, prisma };
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    ip: '127.0.0.1',
    user: { sub: 'user-001' },
    get: vi.fn().mockReturnValue('test-agent'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthCheckController.getIntegrations()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) retorna 200 com summary correto para super_admin', async () => {
    const { controller } = makeController();
    const result = await controller.getIntegrations(makeRequest() as unknown as import('express').Request);

    expect(result.data.integrations).toEqual(mockIntegrations);
    expect(result.data.summary).toEqual(mockSummary);
  });

  it('(h) chama audit-log com correlationId ao GET /integrations', async () => {
    const { controller, auditService } = makeController();
    await controller.getIntegrations(makeRequest() as unknown as import('express').Request);

    // auditService.createEvent é fire-and-forget (void) — flush microtasks
    await Promise.resolve();

    // auditService.create é chamado (pode ser void/async)
    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'integration_health',
        resourceId: 'all',
        userId: 'user-001',
      }),
    );
  });

  it('(i) micro-cache retorna cached na segunda chamada sem executar probes', async () => {
    const { controller, healthCheckService } = makeController();
    const req = makeRequest() as unknown as import('express').Request;

    await controller.getIntegrations(req);
    await controller.getIntegrations(req);

    // runAllProbes deve ser chamado apenas 1x (cache hit na 2ª chamada)
    expect(healthCheckService.runAllProbes).toHaveBeenCalledTimes(1);
  });

  it('cache expira após TTL e executa probes novamente', async () => {
    const { controller, healthCheckService } = makeController();
    const req = makeRequest() as unknown as import('express').Request;

    await controller.getIntegrations(req);

    // Simular cache expirado: manipular timestamp interno
    if ((controller as unknown as { cache: { timestamp: number } | null }).cache) {
      (controller as unknown as { cache: { timestamp: number } }).cache!.timestamp = Date.now() - 11_000;
    }

    await controller.getIntegrations(req);
    expect(healthCheckService.runAllProbes).toHaveBeenCalledTimes(2);
  });
});

describe('HealthCheckController.getIntegrationsHistory()', () => {
  it('(d) retorna 200 com points e meta', async () => {
    const { controller, prisma } = makeController();
    (prisma.client.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'id-1', integration_name: 'Redis', status: 'healthy', latency_ms: 2, message: null, checked_at: new Date('2026-06-22T03:00:00Z') },
    ]);

    const result = await controller.getIntegrationsHistory({ integration: 'Redis', hours: 24 });
    const r = result as { data: { integration: string; points: unknown[]; hours: number }; meta: { total: number } };
    expect(r.data.integration).toBe('Redis');
    expect(r.data.points).toHaveLength(1);
    expect(r.data.hours).toBe(24);
    expect(r.meta.total).toBe(1);
  });

  it('(f) retorna vazio quando não há histórico', async () => {
    const { controller } = makeController();
    const result = await controller.getIntegrationsHistory({ integration: 'Resend', hours: 24 });
    const r = result as { data: { points: unknown[] } };
    expect(r.data.points).toHaveLength(0);
  });
});
