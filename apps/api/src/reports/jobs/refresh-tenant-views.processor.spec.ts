import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the privileged Prisma client + adapter ─────────────────────────────
const privilegedExecuteRawUnsafe = vi.fn().mockResolvedValue(0);
const privilegedDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn(function (this: { __connectionString: string }, opts: { connectionString: string }) {
    this.__connectionString = opts.connectionString;
  }),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function (this: Record<string, unknown>) {
    this.$executeRawUnsafe = privilegedExecuteRawUnsafe;
    this.$disconnect = privilegedDisconnect;
  }),
}));

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { RefreshTenantViewsProcessor } from './refresh-tenant-views.processor';

// ─── Test doubles ─────────────────────────────────────────────────────────────
function buildProcessor() {
  const bullMqService = {
    createQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue(undefined) })),
    createWorker: vi.fn(() => ({ on: vi.fn() })),
  } as never;

  const mvRefreshLogCreate = vi.fn().mockResolvedValue(undefined);
  const prisma = { client: { mvRefreshLog: { create: mvRefreshLogCreate } } } as never;

  const configService = {
    get: vi.fn((key: string) =>
      key === 'DATABASE_URL' ? 'postgresql://metanoia:pass@localhost:5432/db' : undefined,
    ),
  } as never;

  const processor = new RefreshTenantViewsProcessor(bullMqService, prisma, configService);
  return { processor, mvRefreshLogCreate, configService };
}

// Expose private processRefresh for unit testing.
function callProcessRefresh(processor: RefreshTenantViewsProcessor): Promise<void> {
  return (processor as unknown as { processRefresh: (job: unknown) => Promise<void> }).processRefresh({});
}

describe('RefreshTenantViewsProcessor — privileged refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a privileged client from DATABASE_URL (ConfigService)', async () => {
    const { processor, configService } = buildProcessor();
    await callProcessRefresh(processor);

    expect((configService as unknown as { get: ReturnType<typeof vi.fn> }).get).toHaveBeenCalledWith(
      'DATABASE_URL',
      { infer: true },
    );
    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: 'postgresql://metanoia:pass@localhost:5432/db',
    });
    expect(PrismaClient).toHaveBeenCalled();
  });

  it('runs REFRESH CONCURRENTLY on the privileged client (not via transaction)', async () => {
    const { processor } = buildProcessor();
    await callProcessRefresh(processor);

    expect(privilegedExecuteRawUnsafe).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_report',
    );
  });

  it('writes a success log on the app client and disconnects the privileged client', async () => {
    const { processor, mvRefreshLogCreate } = buildProcessor();
    await callProcessRefresh(processor);

    expect(mvRefreshLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mvName: 'mv_tenant_report', status: 'success', tenantId: null }),
      }),
    );
    expect(privilegedDisconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects the privileged client and logs failure when REFRESH throws', async () => {
    const { processor, mvRefreshLogCreate } = buildProcessor();
    privilegedExecuteRawUnsafe.mockRejectedValueOnce(new Error('boom'));

    await expect(callProcessRefresh(processor)).rejects.toThrow('boom');

    expect(mvRefreshLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', tenantId: null }),
      }),
    );
    expect(privilegedDisconnect).toHaveBeenCalledTimes(1);
  });
});
