import { describe, it, expect, vi } from 'vitest';
import { UsersService } from '../users.service';

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const TENANT_B = '01912345-6789-7000-8000-000000000002';

const baseUser = {
  id: USER_ID,
  email: 'test@example.com',
  name: 'Test User',
  status: 'active',
  onboardingCompletedAt: new Date('2026-01-15T10:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

function makePrisma(userResult: unknown, tenantsResult: unknown[]) {
  return {
    client: {
      user: { findUnique: vi.fn().mockResolvedValue(userResult) },
      userTenant: { findMany: vi.fn().mockResolvedValue(tenantsResult) },
    },
  };
}

describe('UsersService.exportUserData', () => {
  it('returns profile and tenants with ISO 8601 dates', async () => {
    const prisma = makePrisma(baseUser, [
      { tenantId: TENANT_ID, role: 'lider', createdAt: new Date('2026-01-02T00:00:00.000Z') },
    ]);
    const svc = new UsersService(prisma as never);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.profile).not.toBeNull();
    expect(result.profile?.id).toBe(USER_ID);
    expect(result.profile?.email).toBe('test@example.com');
    expect(result.profile?.onboardingCompletedAt).toBe('2026-01-15T10:00:00.000Z');
    expect(result.profile?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.profile?.updatedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(result.tenants).toHaveLength(1);
    expect(result.tenants[0].joinedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(result.tenants[0].tenantId).toBe(TENANT_ID);
  });

  it('returns profile null when user not found', async () => {
    const prisma = makePrisma(null, []);
    const svc = new UsersService(prisma as never);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.profile).toBeNull();
    expect(result.tenants).toHaveLength(0);
  });

  it('maps onboardingCompletedAt as null when not set', async () => {
    const prisma = makePrisma({ ...baseUser, onboardingCompletedAt: null }, []);
    const svc = new UsersService(prisma as never);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.profile?.onboardingCompletedAt).toBeNull();
  });

  it('returns multiple tenants', async () => {
    const prisma = makePrisma(baseUser, [
      { tenantId: TENANT_ID, role: 'membro', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { tenantId: TENANT_B, role: 'lider', createdAt: new Date('2026-03-01T00:00:00.000Z') },
    ]);
    const svc = new UsersService(prisma as never);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.tenants).toHaveLength(2);
    expect(result.tenants[1].tenantId).toBe(TENANT_B);
    expect(result.tenants[1].role).toBe('lider');
  });

  it('does not include tenantId in profile (CL-02/dec-019)', async () => {
    const prisma = makePrisma(baseUser, []);
    const svc = new UsersService(prisma as never);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.profile).not.toHaveProperty('tenantId');
  });
});
