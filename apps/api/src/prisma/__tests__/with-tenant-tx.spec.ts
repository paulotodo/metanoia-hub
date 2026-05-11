import { describe, it, expect, vi } from 'vitest';
import { withTenantTx } from '../with-tenant-tx';
import { requestContext } from '../../common/context/request-context';
import type { PrismaService } from '../prisma.service';

const VALID = '01912345-6789-7000-8000-000000000001';
const OTHER = '01999999-9999-7999-8999-999999999999';

function makePrisma() {
  const tx = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  };
  const $transaction = vi.fn(
    async (cb: (handle: typeof tx) => unknown) => cb(tx),
  );
  return {
    prisma: { client: { $transaction } } as unknown as PrismaService,
    tx,
    $transaction,
  };
}

describe('withTenantTx', () => {
  it('uses opts.tenantId over RequestContext tenantId when both exist', async () => {
    const { prisma, tx } = makePrisma();
    await requestContext.run(
      { tenantId: OTHER, requestId: 'r', correlationId: 'c' },
      async () => {
        await withTenantTx(prisma, async () => 1, { tenantId: VALID });
      },
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      `SET LOCAL app.current_tenant_id = '${VALID}'`,
    );
  });

  it('falls back to RequestContext tenantId when opts.tenantId is omitted', async () => {
    const { prisma, tx } = makePrisma();
    await requestContext.run(
      { tenantId: VALID, requestId: 'r', correlationId: 'c' },
      async () => {
        await withTenantTx(prisma, async () => 1);
      },
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      `SET LOCAL app.current_tenant_id = '${VALID}'`,
    );
  });

  it('throws when neither opts.tenantId nor RequestContext is available', async () => {
    const { prisma } = makePrisma();
    await expect(withTenantTx(prisma, async () => 1)).rejects.toThrow(
      /requires a tenantId/,
    );
  });

  it('rejects non-UUID tenantId', async () => {
    const { prisma } = makePrisma();
    await expect(
      withTenantTx(prisma, async () => 1, { tenantId: 'not-a-uuid' }),
    ).rejects.toThrow(/Refusing SET LOCAL with non-UUID/);
  });

  it('propagates the tx handle to the callback and returns its result', async () => {
    const { prisma, tx } = makePrisma();
    const result = await withTenantTx(
      prisma,
      async (handle) => {
        expect(handle).toBe(tx);
        return 42;
      },
      { tenantId: VALID },
    );
    expect(result).toBe(42);
  });

  it('lets errors inside the callback bubble so the transaction rolls back', async () => {
    const { prisma } = makePrisma();
    await expect(
      withTenantTx(
        prisma,
        async () => {
          throw new Error('boom');
        },
        { tenantId: VALID },
      ),
    ).rejects.toThrow('boom');
  });
});
