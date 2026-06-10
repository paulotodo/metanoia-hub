import { describe, it, expect, vi } from 'vitest';
import { generateId } from '@metanoia/types';
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
