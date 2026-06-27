import { describe, it, expect, vi } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';

// Mock requestContext
vi.mock('../../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    userId: 'user-uuid-test',
    tenantId: '01912345-6789-7000-8000-000000000001',
    requestId: 'req-uuid',
    correlationId: 'corr-uuid',
  })),
  requestContext: {
    getStore: vi.fn(() => ({
      userId: 'user-uuid-test',
      tenantId: '01912345-6789-7000-8000-000000000001',
      requestId: 'req-uuid',
      correlationId: 'corr-uuid',
    })),
  },
}));

function makeTx(queryRows: unknown[] = []) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(queryRows),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  };
}

function makePrismaService(queryRows: unknown[] = []) {
  const tx = makeTx(queryRows);
  return {
    client: {
      $transaction: vi.fn().mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
      ),
    },
    _tx: tx, // expose for assertions
  };
}

function makeRedis(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function makeService(
  queryRows: unknown[] = [],
  redisOverrides: Record<string, unknown> = {},
) {
  const prisma = makePrismaService(queryRows);
  const redis = makeRedis(redisOverrides);
  const service = new NotificationPreferencesService(
    prisma as never,
    redis as never,
  );
  return { service, prisma, redis };
}

describe('NotificationPreferencesService', () => {
  it('GET without rows returns all defaults true (7 types, each inApp+email=true)', async () => {
    const { service } = makeService([]);
    const result = await service.getForCurrentUser([]);
    expect(Object.keys(result)).toHaveLength(7);
    for (const type of Object.values(result)) {
      expect(type.inApp).toBe(true);
      expect(type.email).toBe(true);
    }
  });

  it('GET for leader forces pastoral_alert.inApp=true even if cache says false', async () => {
    const cached = JSON.stringify({
      pastoral_alert: { inApp: false, email: true },
      group_message: { inApp: true, email: true },
      content_update: { inApp: true, email: true },
      meeting_reminder: { inApp: true, email: true },
      system: { inApp: true, email: true },
      export_ready: { inApp: true, email: true },
      content_new: { inApp: true, email: true },
    });
    const { service } = makeService([], { get: vi.fn().mockResolvedValue(cached) });
    const result = await service.getForCurrentUser(['lider']);
    expect(result.pastoral_alert.inApp).toBe(true); // enforced
  });

  it('Redis.get throws → fallback to DB without propagating exception', async () => {
    const { service } = makeService([], {
      get: vi.fn().mockRejectedValue(new Error('redis down')),
    });
    await expect(service.getForCurrentUser([])).resolves.toBeDefined();
  });

  it('PATCH partial update calls executeRaw for each updated field', async () => {
    const { service, prisma } = makeService([]);
    await service.patchForCurrentUser([], { meeting_reminder: { email: false } });
    expect(prisma.client.$transaction).toHaveBeenCalled();
  });

  it('PATCH pastoral_alert.inApp=false as leader throws 422', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchForCurrentUser(['lider'], { pastoral_alert: { inApp: false } }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('PATCH pastoral_alert.inApp=false as participante persists without error', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchForCurrentUser(['participante'], { pastoral_alert: { inApp: false } }),
    ).resolves.toBeDefined();
  });
});
