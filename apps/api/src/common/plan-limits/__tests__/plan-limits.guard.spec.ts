import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { generateId } from '@metanoia/types';
import { PlanLimitsGuard } from '../plan-limits.guard';
import { PlanLimitsService } from '../plan-limits.service';
import { requestContext } from '../../context/request-context';

const TENANT = '01912345-6789-7000-8000-000000000001';

function buildContext(): ExecutionContext {
  const handler = vi.fn() as unknown as () => unknown;
  return {
    getHandler: () => handler,
    getClass: () => function StubController() { return null; },
    switchToHttp: () => ({
      getRequest: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function makeReflector(meta: string | undefined): Reflector {
  const r = new Reflector();
  vi.spyOn(r, 'getAllAndOverride').mockReturnValue(meta);
  return r;
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT,
      userId: '01912345-6789-7000-8000-0000000000aa',
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('PlanLimitsGuard', () => {
  let service: PlanLimitsService;

  beforeEach(() => {
    service = {
      hasCapacity: vi.fn(),
    } as unknown as PlanLimitsService;
  });

  it('passes through when route has no @PlanLimit metadata', async () => {
    const guard = new PlanLimitsGuard(makeReflector(undefined), service);
    const result = await withCtx(() => guard.canActivate(buildContext()));
    expect(result).toBe(true);
    expect(service.hasCapacity).not.toHaveBeenCalled();
  });

  it('passes when tenant under cap', async () => {
    (service.hasCapacity as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      current: 1,
      limit: 3,
      plan: 'free',
    });
    const guard = new PlanLimitsGuard(makeReflector('groups'), service);
    const result = await withCtx(() => guard.canActivate(buildContext()));
    expect(result).toBe(true);
    expect(service.hasCapacity).toHaveBeenCalledWith(TENANT, 'groups');
  });

  it('throws 403 ForbiddenException when tenant at cap', async () => {
    (service.hasCapacity as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      current: 3,
      limit: 3,
      plan: 'free',
    });
    const guard = new PlanLimitsGuard(makeReflector('groups'), service);

    await expect(
      withCtx(() => guard.canActivate(buildContext())),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('error response includes resource, plan, current, limit details', async () => {
    (service.hasCapacity as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      current: 25,
      limit: 25,
      plan: 'pro',
    });
    const guard = new PlanLimitsGuard(makeReflector('groups'), service);

    try {
      await withCtx(() => guard.canActivate(buildContext()));
      expect.fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse() as {
        details: { resource: string; plan: string; current: number; limit: number };
      };
      expect(body.details).toEqual({
        resource: 'groups',
        plan: 'pro',
        current: 25,
        limit: 25,
      });
    }
  });

  it('passes through when no tenant context (auth/middleware will reject earlier)', async () => {
    const guard = new PlanLimitsGuard(makeReflector('groups'), service);
    const result = await requestContext.run(
      {
        tenantId: undefined as unknown as string,
        userId: undefined,
        requestId: generateId(),
        correlationId: generateId(),
      },
      () => guard.canActivate(buildContext()),
    );
    expect(result).toBe(true);
  });
});
