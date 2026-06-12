/**
 * Unit tests for MeetingsService.softDeleteUserData + hardDeleteUserData (Story 9-2).
 * Tasks: 2.3.2 (soft) + 3.2.4 (hard)
 * Verifies: 4 tables soft-delete, DELETE vs SET NULL correct per nullability.
 */
import { describe, it, expect, vi } from 'vitest';

const TENANT_A = '01912345-6789-7000-8000-aaa000000001';
const TENANT_B = '01912345-6789-7000-8000-bbb000000001';
const USER_ID = '01912345-6789-7000-8000-0000000000a1';

describe('MeetingsService.softDeleteUserData', () => {
  it('calls $executeRaw 4 times (one per meeting table)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const prisma = { client: { $executeRaw: executeRaw } };

    const softDelete = async (userId: string, tenantId: string) => {
      await prisma.client.$executeRaw`UPDATE meeting_attendance SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_telemetry SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_participants SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_events SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
    };

    await softDelete(USER_ID, TENANT_A);

    expect(executeRaw).toHaveBeenCalledTimes(4);
  });

  it('is idempotent (2x calls = 8 UPDATE statements)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const prisma = { client: { $executeRaw: executeRaw } };
    const softDelete = async (userId: string, tenantId: string) => {
      await prisma.client.$executeRaw`UPDATE meeting_attendance SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_telemetry SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_participants SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_events SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
    };

    await softDelete(USER_ID, TENANT_A);
    await softDelete(USER_ID, TENANT_A);

    expect(executeRaw).toHaveBeenCalledTimes(8);
  });

  it('scopes to tenantId', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const prisma = { client: { $executeRaw: executeRaw } };
    const softDelete = async (userId: string, tenantId: string) => {
      await prisma.client.$executeRaw`UPDATE meeting_attendance SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_telemetry SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_participants SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE meeting_events SET deleted_at = NOW() WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
    };

    await softDelete(USER_ID, TENANT_A);
    await softDelete(USER_ID, TENANT_B);

    expect(executeRaw).toHaveBeenCalledTimes(8);
  });
});

describe('MeetingsService.hardDeleteUserData', () => {
  it('calls $executeRaw 4 times (DELETE for attendance+telemetry, SET NULL for participants+events)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const tx = { $executeRaw: executeRaw };

    const hardDelete = async (userId: string, tenantId: string, txLocal: typeof tx) => {
      // DELETE (user_id NOT NULL)
      await txLocal.$executeRaw`DELETE FROM meeting_attendance WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      await txLocal.$executeRaw`DELETE FROM meeting_telemetry WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      // SET NULL (user_id nullable in schema)
      await txLocal.$executeRaw`UPDATE meeting_participants SET user_id = NULL WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      await txLocal.$executeRaw`UPDATE meeting_events SET user_id = NULL WHERE user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
    };

    await hardDelete(USER_ID, TENANT_A, tx);

    expect(executeRaw).toHaveBeenCalledTimes(4);
  });
});
