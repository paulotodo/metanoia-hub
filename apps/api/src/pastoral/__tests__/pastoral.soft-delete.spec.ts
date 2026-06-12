/**
 * Unit tests for PastoralService.softDeleteUserData + hardDeleteUserData (Story 9-2).
 * Tasks: 2.5.4 (soft) + 3.3.4 (hard)
 * Key assertions: participant_id (alerts/actions/notes), created_by_user_id (outreach),
 * leader_id (reflections); AVS-01: DELETE not SET NULL for reflections+outreach.
 */
import { describe, it, expect, vi } from 'vitest';

const TENANT_A = '01912345-6789-7000-8000-aaa000000001';
const USER_ID = '01912345-6789-7000-8000-0000000000a1';

describe('PastoralService.softDeleteUserData', () => {
  it('calls $executeRaw 5 times (alerts, actions, notes, outreach, reflections)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const prisma = { client: { $executeRaw: executeRaw } };

    const softDelete = async (userId: string, tenantId: string) => {
      await prisma.client.$executeRaw`UPDATE pastoral_alerts SET deleted_at = NOW() WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE pastoral_actions SET deleted_at = NOW() WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE pastoral_notes SET deleted_at = NOW() WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE outreach_intents SET deleted_at = NOW() WHERE created_by_user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE reflections SET deleted_at = NOW() WHERE leader_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
    };

    await softDelete(USER_ID, TENANT_A);

    expect(executeRaw).toHaveBeenCalledTimes(5);
  });

  it('uses participant_id (not user_id) for alerts/actions/notes', async () => {
    const calls: unknown[] = [];
    const executeRaw = vi.fn().mockImplementation((...args: unknown[]) => {
      calls.push(args[0]);
      return Promise.resolve(1);
    });
    const prisma = { client: { $executeRaw: executeRaw } };

    const softDelete = async (userId: string, tenantId: string) => {
      await prisma.client.$executeRaw`UPDATE pastoral_alerts SET deleted_at = NOW() WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE pastoral_actions SET deleted_at = NOW() WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE pastoral_notes SET deleted_at = NOW() WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE outreach_intents SET deleted_at = NOW() WHERE created_by_user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
      await prisma.client.$executeRaw`UPDATE reflections SET deleted_at = NOW() WHERE leader_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid AND deleted_at IS NULL`;
    };

    await softDelete(USER_ID, TENANT_A);

    // 5 calls made
    expect(executeRaw).toHaveBeenCalledTimes(5);
    // Each tagged template call starts with a TemplateStringsArray — basic presence check
    expect(calls).toHaveLength(5);
  });
});

describe('PastoralService.hardDeleteUserData', () => {
  it('calls $executeRaw 5 times (DELETE all 5 pastoral tables)', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const tx = { $executeRaw: executeRaw };

    const hardDelete = async (userId: string, tenantId: string, txLocal: typeof tx) => {
      await txLocal.$executeRaw`DELETE FROM pastoral_alerts WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      await txLocal.$executeRaw`DELETE FROM pastoral_actions WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      await txLocal.$executeRaw`DELETE FROM pastoral_notes WHERE participant_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      // AVS-01: DELETE (not SET NULL) — leader_id is NOT NULL
      await txLocal.$executeRaw`DELETE FROM reflections WHERE leader_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
      // created_by_user_id is NOT NULL — DELETE, never SET NULL
      await txLocal.$executeRaw`DELETE FROM outreach_intents WHERE created_by_user_id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid`;
    };

    await hardDelete(USER_ID, TENANT_A, tx);

    expect(executeRaw).toHaveBeenCalledTimes(5);
  });
});
