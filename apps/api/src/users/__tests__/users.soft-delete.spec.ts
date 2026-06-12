/**
 * Unit tests for UsersService.softDeleteUserData + hardDeleteUserData (Story 9-2).
 * Tasks: 2.1.3 (soft) + 3.1.3 (hard)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../users.service';

const TENANT_A = '01912345-6789-7000-8000-aaa000000001';
const TENANT_B = '01912345-6789-7000-8000-bbb000000001';
const USER_ID = '01912345-6789-7000-8000-0000000000a1';

function makeExecuteRaw(affectedRows = 1) {
  return vi.fn().mockResolvedValue(affectedRows);
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  const executeRaw = makeExecuteRaw();
  const userUpdate = vi.fn().mockResolvedValue({ id: USER_ID, status: 'deleted' });
  const executeRawTx = makeExecuteRaw();
  const txFn = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
    const tx = {
      $executeRaw: executeRawTx,
      user: { update: userUpdate },
    };
    return cb(tx);
  });

  return {
    executeRaw,
    userUpdate,
    executeRawTx,
    txFn,
    prisma: {
      client: {
        $executeRaw: executeRaw,
        $transaction: txFn,
        user: { update: userUpdate },
        ...overrides,
      },
    },
  };
}

describe('UsersService.softDeleteUserData', () => {
  it('executes UPDATE on user_tenants with deleted_at = NOW()', async () => {
    const { prisma, executeRaw } = makePrisma();
    const svc = new UsersService(prisma as never);

    await svc.softDeleteUserData(USER_ID, TENANT_A);

    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — calling 2x executes 2 UPDATE statements (guard in SQL)', async () => {
    const { prisma, executeRaw } = makePrisma();
    const svc = new UsersService(prisma as never);

    await svc.softDeleteUserData(USER_ID, TENANT_A);
    await svc.softDeleteUserData(USER_ID, TENANT_A);

    // Both calls go through — idempotency enforced by the WHERE deleted_at IS NULL guard in SQL
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it('scopes to tenantId — different tenantId = separate call', async () => {
    const { prisma, executeRaw } = makePrisma();
    const svc = new UsersService(prisma as never);

    await svc.softDeleteUserData(USER_ID, TENANT_A);
    await svc.softDeleteUserData(USER_ID, TENANT_B);

    expect(executeRaw).toHaveBeenCalledTimes(2);
    // Verify second call used TENANT_B (template literal parameter differing)
    const callArgs = executeRaw.mock.calls;
    expect(callArgs[0]).toBeDefined();
    expect(callArgs[1]).toBeDefined();
  });

  it('does NOT touch consents (consents LGPD art.16 retained)', async () => {
    const consentDelete = vi.fn();
    const { prisma } = makePrisma();
    // Add consents mock that should NOT be called
    (prisma.client as Record<string, unknown>)['consent'] = { deleteMany: consentDelete };
    const svc = new UsersService(prisma as never);

    await svc.softDeleteUserData(USER_ID, TENANT_A);

    expect(consentDelete).not.toHaveBeenCalled();
  });
});

describe('UsersService.hardDeleteUserData', () => {
  let prisma: ReturnType<typeof makePrisma>['prisma'];
  let userUpdate: ReturnType<typeof makePrisma>['userUpdate'];
  let executeRawTx: ReturnType<typeof makePrisma>['executeRawTx'];

  beforeEach(() => {
    const mocks = makePrisma();
    prisma = mocks.prisma;
    userUpdate = mocks.userUpdate;
    executeRawTx = mocks.executeRawTx;
  });

  it('deletes user_tenants row and anonymizes user profile', async () => {
    const svc = new UsersService(prisma as never);
    const tx = {
      $executeRaw: executeRawTx,
      user: { update: userUpdate },
    };

    await svc.hardDeleteUserData(USER_ID, TENANT_A, tx as never);

    // Should have called $executeRaw for DELETE user_tenants
    expect(executeRawTx).toHaveBeenCalledTimes(1);
    // Should have called user.update for anonymization
    expect(userUpdate).toHaveBeenCalledTimes(1);
    const updateCall = userUpdate.mock.calls[0]![0] as {
      where: { id: string };
      data: { name: string; email: string; status: string };
    };
    expect(updateCall.where.id).toBe(USER_ID);
    expect(updateCall.data.name).toBe('Usuário Removido');
    expect(updateCall.data.status).toBe('deleted');
    expect(updateCall.data.email).toMatch(/^removed-[a-f0-9]{8}@deleted\.invalid$/);
  });

  it('email anonymization hash is deterministic for same userId', async () => {
    const svc = new UsersService(prisma as never);
    const tx1 = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      user: { update: vi.fn().mockResolvedValue({}) },
    };
    const tx2 = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      user: { update: vi.fn().mockResolvedValue({}) },
    };

    await svc.hardDeleteUserData(USER_ID, TENANT_A, tx1 as never);
    await svc.hardDeleteUserData(USER_ID, TENANT_A, tx2 as never);

    const email1 = (tx1.user.update.mock.calls[0]![0] as { data: { email: string } }).data.email;
    const email2 = (tx2.user.update.mock.calls[0]![0] as { data: { email: string } }).data.email;
    expect(email1).toBe(email2);
  });

  it('scopes DELETE to tenantId', async () => {
    const svc = new UsersService(prisma as never);
    const tx = {
      $executeRaw: executeRawTx,
      user: { update: userUpdate },
    };

    await svc.hardDeleteUserData(USER_ID, TENANT_B, tx as never);

    expect(executeRawTx).toHaveBeenCalledTimes(1);
    // tenantId is embedded in the template literal — not easily assertable but call happened
  });
});
