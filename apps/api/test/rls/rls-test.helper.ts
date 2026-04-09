import { PrismaClient } from '@prisma/client';
import { generateId } from '@metanoia/types';

const TENANT_A_ID = '01912345-6789-7000-8000-000000000001';
const TENANT_B_ID = '01912345-6789-7000-8000-000000000002';

export { TENANT_A_ID, TENANT_B_ID };

/**
 * Creates a test health record for a given tenant within a transaction
 * that has the tenant context set.
 */
export async function createHealthRecord(prisma: PrismaClient, tenantId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    return tx.health.create({
      data: {
        id: generateId(),
        tenantId,
        status: 'ok',
      },
    });
  });
}

/**
 * Reads health records visible to a given tenant.
 */
export async function readHealthRecords(prisma: PrismaClient, tenantId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    return tx.health.findMany();
  });
}

/**
 * Deletes all health records for a given tenant (cleanup helper).
 */
export async function deleteAllHealthRecords(prisma: PrismaClient, tenantId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    return tx.health.deleteMany();
  });
}
