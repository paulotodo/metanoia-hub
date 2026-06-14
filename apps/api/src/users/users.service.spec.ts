import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId } from '@metanoia/types';
import * as withTenantTxModule from '../prisma/with-tenant-tx';
import { UsersService } from './users.service';
import { requestContext } from '../common/context/request-context';

const TENANT = '01912345-6789-7000-8000-000000000001';
const USER_ID = '01912345-6789-7000-8000-0000000000a1';

function mockPrisma(userOverrides: Record<string, unknown> = {}) {
  return {
    client: {
      user: {
        update: vi.fn().mockResolvedValue({
          id: USER_ID,
          onboardingCompletedAt: new Date('2026-01-01T12:00:00.000Z'),
          ...userOverrides,
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          onboardingCompletedAt: new Date('2026-01-01T12:00:00.000Z'),
          ...userOverrides,
        }),
      },
    },
  };
}

async function withCtx<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT,
      userId,
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('UsersService.completeOnboarding', () => {
  it('sets onboarding_completed_at and returns ISO string', async () => {
    const prisma = mockPrisma();
    const service = new UsersService(prisma as never);

    const result = await withCtx(USER_ID, () => service.completeOnboarding());

    expect(result.userId).toBe(USER_ID);
    expect(result.onboardingCompletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(prisma.client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({ onboardingCompletedAt: expect.any(Date) }),
      }),
    );
  });

  it('is idempotent — returns existing timestamp if already set', async () => {
    const existing = new Date('2026-05-10T08:00:00.000Z');
    const prisma = mockPrisma({ onboardingCompletedAt: existing });
    const service = new UsersService(prisma as never);

    const result = await withCtx(USER_ID, () => service.completeOnboarding());

    expect(result.onboardingCompletedAt).toBe(existing.toISOString());
  });

  it('throws if userId is absent in RequestContext', async () => {
    const prisma = mockPrisma();
    const service = new UsersService(prisma as never);

    await expect(
      requestContext.run(
        { tenantId: TENANT, requestId: generateId(), correlationId: generateId() },
        () => service.completeOnboarding(),
      ),
    ).rejects.toThrow('completeOnboarding requires userId');
  });
});

describe('UsersService.getOnboardingStatus', () => {
  it('returns ISO timestamp when onboarding complete', async () => {
    const prisma = mockPrisma({ onboardingCompletedAt: new Date('2026-06-01T00:00:00.000Z') });
    const service = new UsersService(prisma as never);

    const result = await withCtx(USER_ID, () => service.getOnboardingStatus());

    expect(result.onboardingCompletedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('returns null when onboarding is pending', async () => {
    const prisma = mockPrisma({ onboardingCompletedAt: null });
    const service = new UsersService(prisma as never);

    const result = await withCtx(USER_ID, () => service.getOnboardingStatus());

    expect(result.onboardingCompletedAt).toBeNull();
  });
});

// ─── UsersService.updateProfile ──────────────────────────────────────────────

describe('UsersService.updateProfile', () => {
  // Mock tx object simulating Prisma transaction handle
  const mockTx = {
    user: {
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockTx.user.update.mockResolvedValue({
      id: USER_ID,
      name: 'Pastor João',
      profilePhotoUrl: 'https://minio.test/users/01/avatar.png',
      roleTitle: 'Pastor',
    });
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(mockTx as unknown as Parameters<typeof fn>[0]),
    );
  });

  it('updates name, profilePhotoUrl and roleTitle via explicit fields', async () => {
    const prisma = mockPrisma();
    const service = new UsersService(prisma as never);

    const result = await withCtx(USER_ID, () =>
      service.updateProfile({
        name: 'Pastor João',
        profilePhotoUrl: 'https://minio.test/users/01/avatar.png',
        roleTitle: 'Pastor',
      }),
    );

    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({
          name: 'Pastor João',
          profilePhotoUrl: 'https://minio.test/users/01/avatar.png',
          roleTitle: 'Pastor',
        }),
      }),
    );
    expect(result.data.name).toBe('Pastor João');
    expect(result.data.profilePhotoUrl).toBe('https://minio.test/users/01/avatar.png');
    expect(result.data.roleTitle).toBe('Pastor');
  });

  it('omits undefined fields from the update data (partial update — no profilePhotoUrl key in data)', async () => {
    // When only `name` is provided, profilePhotoUrl and roleTitle must NOT appear
    // in the Prisma `data` object (anti-mass-assignment / no accidental nullification).
    let capturedData: Record<string, unknown> = {};
    mockTx.user.update.mockImplementation((args: { data: Record<string, unknown> }) => {
      capturedData = args.data;
      return Promise.resolve({ id: USER_ID, name: 'Updated Name', profilePhotoUrl: null, roleTitle: null });
    });

    const prisma = mockPrisma();
    const service = new UsersService(prisma as never);

    await withCtx(USER_ID, () =>
      service.updateProfile({ name: 'Updated Name' }),
    );

    expect('name' in capturedData).toBe(true);
    expect('profilePhotoUrl' in capturedData).toBe(false);
    expect('roleTitle' in capturedData).toBe(false);
  });

  it('returns null for profilePhotoUrl when not set', async () => {
    mockTx.user.update.mockResolvedValue({
      id: USER_ID,
      name: 'João',
      profilePhotoUrl: null,
      roleTitle: null,
    });
    const prisma = mockPrisma();
    const service = new UsersService(prisma as never);

    const result = await withCtx(USER_ID, () =>
      service.updateProfile({ name: 'João' }),
    );

    expect(result.data.profilePhotoUrl).toBeNull();
    expect(result.data.roleTitle).toBeNull();
  });

  it('resolves userId from AsyncLocalStorage — never from body', async () => {
    const prisma = mockPrisma();
    const service = new UsersService(prisma as never);

    await withCtx(USER_ID, () =>
      service.updateProfile({ name: 'Test' }),
    );

    // The update `where` clause must use userId from context, not from any param
    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    );
  });

  it('throws if userId is absent in RequestContext', async () => {
    const prisma = mockPrisma();
    const service = new UsersService(prisma as never);

    await expect(
      requestContext.run(
        { tenantId: TENANT, requestId: generateId(), correlationId: generateId() },
        () => service.updateProfile({ name: 'Test' }),
      ),
    ).rejects.toThrow('updateProfile requires userId');
  });
});

// ─── UsersService.checkEmailsInTenant ────────────────────────────────────────

describe('UsersService.checkEmailsInTenant', () => {
  const mockFindMany = vi.fn();

  // Mock withTenantTx to execute the callback with a mock tx
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) =>
        fn({
          user: { findMany: mockFindMany },
        } as unknown as Parameters<typeof fn>[0]),
    );
  });

  function makePrisma() {
    return { client: { user: { findMany: mockFindMany } } };
  }

  it('returns exists:true for emails found in tenant, exists:false otherwise', async () => {
    mockFindMany.mockResolvedValue([{ email: 'joao@igreja.org' }]);

    const service = new UsersService(makePrisma() as never);
    const result = await withCtx(USER_ID, () =>
      service.checkEmailsInTenant(['joao@igreja.org', 'maria@igreja.org']),
    );

    expect(result).toEqual([
      { email: 'joao@igreja.org', exists: true },
      { email: 'maria@igreja.org', exists: false },
    ]);
  });

  it('preserves INPUT ORDER even when DB returns in different order (API-10-C1)', async () => {
    // DB returns 'a@x.com' first even though input has 'b@x.com' first
    mockFindMany.mockResolvedValue([
      { email: 'a@x.com' },
      { email: 'b@x.com' },
    ]);

    const service = new UsersService(makePrisma() as never);
    const result = await withCtx(USER_ID, () =>
      service.checkEmailsInTenant(['b@x.com', 'a@x.com']),
    );

    // Must respect input order: b first, then a
    expect(result[0]).toEqual({ email: 'b@x.com', exists: true });
    expect(result[1]).toEqual({ email: 'a@x.com', exists: true });
  });

  it('returns all exists:false when DB returns no rows', async () => {
    mockFindMany.mockResolvedValue([]);

    const service = new UsersService(makePrisma() as never);
    const result = await withCtx(USER_ID, () =>
      service.checkEmailsInTenant(['unknown@x.com']),
    );

    expect(result).toEqual([{ email: 'unknown@x.com', exists: false }]);
  });

  it('does NOT log the email list — only counts (PII policy RQ-06-G1)', async () => {
    mockFindMany.mockResolvedValue([]);

    const service = new UsersService(makePrisma() as never);
    const logSpy = vi.spyOn((service as unknown as { logger: { log: (...args: unknown[]) => void } }).logger, 'log');

    await withCtx(USER_ID, () =>
      service.checkEmailsInTenant(['secret@example.com']),
    );

    // logger.log was called, but the email list must NOT appear in any argument
    for (const call of logSpy.mock.calls) {
      const callStr = JSON.stringify(call);
      expect(callStr).not.toContain('secret@example.com');
    }
  });

  it('handles empty list gracefully (returns empty array)', async () => {
    mockFindMany.mockResolvedValue([]);

    const service = new UsersService(makePrisma() as never);
    const result = await withCtx(USER_ID, () =>
      service.checkEmailsInTenant([]),
    );

    expect(result).toEqual([]);
  });
});
