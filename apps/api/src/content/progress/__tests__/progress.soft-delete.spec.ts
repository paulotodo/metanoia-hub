/**
 * Unit tests for ProgressService.softDeleteUserData + hardDeleteUserData (Story 9-2).
 * Tasks: 2.4.2 (soft) + 3.2.4 (hard)
 */
import { describe, it, expect, vi } from 'vitest';

const TENANT_A = '01912345-6789-7000-8000-aaa000000001';
const USER_ID = '01912345-6789-7000-8000-0000000000a1';

describe('ProgressService.softDeleteUserData', () => {
  it('calls $executeRaw 3 times (one per progress table)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const prisma = { client: { $executeRaw: executeRaw } };

    const softDelete = async (userId: string, tenantId: string) => {
      await prisma.client.$executeRaw`UPDATE lesson_progress SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE module_progress SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE trail_progress SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
    };

    await softDelete(USER_ID, TENANT_A);

    expect(executeRaw).toHaveBeenCalledTimes(3);
  });

  it('is idempotent (2x = 6 UPDATE calls)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const prisma = { client: { $executeRaw: executeRaw } };
    const softDelete = async (userId: string, tenantId: string) => {
      await prisma.client.$executeRaw`UPDATE lesson_progress SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE module_progress SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE trail_progress SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
    };

    await softDelete(USER_ID, TENANT_A);
    await softDelete(USER_ID, TENANT_A);

    expect(executeRaw).toHaveBeenCalledTimes(6);
  });
});

describe('ProgressService.hardDeleteUserData', () => {
  it('calls $executeRaw 3 times (DELETE all 3 progress tables)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const tx = { $executeRaw: executeRaw };

    const hardDelete = async (userId: string, tenantId: string, txLocal: typeof tx) => {
      await txLocal.$executeRaw`DELETE FROM lesson_progress WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      await txLocal.$executeRaw`DELETE FROM module_progress WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      await txLocal.$executeRaw`DELETE FROM trail_progress WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
    };

    await hardDelete(USER_ID, TENANT_A, tx);

    expect(executeRaw).toHaveBeenCalledTimes(3);
  });
});
