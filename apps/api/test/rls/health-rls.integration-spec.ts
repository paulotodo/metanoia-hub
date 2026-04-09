import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  TENANT_A_ID,
  TENANT_B_ID,
  createHealthRecord,
  readHealthRecords,
  deleteAllHealthRecords,
} from './rls-test.helper';

describe('RLS Isolation: _health table', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    // Clean up leftover test data for both tenants
    await deleteAllHealthRecords(prisma, TENANT_A_ID);
    await deleteAllHealthRecords(prisma, TENANT_B_ID);
  });

  afterAll(async () => {
    await deleteAllHealthRecords(prisma, TENANT_A_ID);
    await deleteAllHealthRecords(prisma, TENANT_B_ID);
    await prisma.$disconnect();
  });

  it('should isolate Tenant A data from Tenant B', async () => {
    const recordA = await createHealthRecord(prisma, TENANT_A_ID);
    expect(recordA.tenantId).toBe(TENANT_A_ID);

    const recordB = await createHealthRecord(prisma, TENANT_B_ID);
    expect(recordB.tenantId).toBe(TENANT_B_ID);

    // Tenant A should only see their own records
    const visibleToA = await readHealthRecords(prisma, TENANT_A_ID);
    expect(visibleToA.every((r) => r.tenantId === TENANT_A_ID)).toBe(true);
    expect(visibleToA.some((r) => r.tenantId === TENANT_B_ID)).toBe(false);

    // Tenant B should only see their own records
    const visibleToB = await readHealthRecords(prisma, TENANT_B_ID);
    expect(visibleToB.every((r) => r.tenantId === TENANT_B_ID)).toBe(true);
    expect(visibleToB.some((r) => r.tenantId === TENANT_A_ID)).toBe(false);
  });

  it('should prevent Tenant A from updating Tenant B records', async () => {
    const recordB = await createHealthRecord(prisma, TENANT_B_ID);

    const updateResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`,
      );
      return tx.health.updateMany({
        where: { id: recordB.id },
        data: { status: 'hacked' },
      });
    });

    expect(updateResult.count).toBe(0);
  });

  it('should prevent Tenant A from deleting Tenant B records', async () => {
    const recordB = await createHealthRecord(prisma, TENANT_B_ID);

    const deleteResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`,
      );
      return tx.health.deleteMany({
        where: { id: recordB.id },
      });
    });

    expect(deleteResult.count).toBe(0);
  });
});
