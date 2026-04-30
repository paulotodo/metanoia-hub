import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { generateId } from '@metanoia/types';
import { ConsentGuard } from '../consent.guard';
import { ConsentService } from '../consent.service';
import { requestContext } from '../../common/context/request-context';
import { CURRENT_CONSENT_VERSIONS } from '../consent.versions';

const USER = '01912345-6789-7000-8000-0000000000a1';

function buildContext(): ExecutionContext {
  return {
    getHandler: () => function StubHandler() { return null; },
    getClass: () => function StubController() { return null; },
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

function makeReflector(skip: boolean): Reflector {
  const r = new Reflector();
  vi.spyOn(r, 'getAllAndOverride').mockReturnValue(skip);
  return r;
}

async function withCtx<T>(userId: string | undefined, fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: '01912345-6789-7000-8000-000000000001',
      userId,
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('ConsentGuard', () => {
  it('passes when @SkipConsent is set on the route', async () => {
    const service = { getStatus: vi.fn() } as unknown as ConsentService;
    const guard = new ConsentGuard(makeReflector(true), service);
    const result = await withCtx(USER, () => guard.canActivate(buildContext()));
    expect(result).toBe(true);
    expect(service.getStatus).not.toHaveBeenCalled();
  });

  it('passes when no userId in context (auth guard rejects upstream)', async () => {
    const service = { getStatus: vi.fn() } as unknown as ConsentService;
    const guard = new ConsentGuard(makeReflector(false), service);
    const result = await withCtx(undefined, () =>
      guard.canActivate(buildContext()),
    );
    expect(result).toBe(true);
  });

  it('passes when all consents up to date', async () => {
    const service = {
      getStatus: vi.fn().mockResolvedValue({
        data: {
          documents: [
            { documentType: 'terms_of_service', currentVersion: CURRENT_CONSENT_VERSIONS.terms_of_service, acceptedVersion: CURRENT_CONSENT_VERSIONS.terms_of_service, acceptedAt: '2026-04-09T00:00:00.000Z', isUpToDate: true },
            { documentType: 'privacy_policy', currentVersion: CURRENT_CONSENT_VERSIONS.privacy_policy, acceptedVersion: CURRENT_CONSENT_VERSIONS.privacy_policy, acceptedAt: '2026-04-09T00:00:00.000Z', isUpToDate: true },
          ],
          allUpToDate: true,
        },
      }),
    } as unknown as ConsentService;
    const guard = new ConsentGuard(makeReflector(false), service);
    const result = await withCtx(USER, () => guard.canActivate(buildContext()));
    expect(result).toBe(true);
  });

  it('throws ConsentRequired when documents are out of date', async () => {
    const service = {
      getStatus: vi.fn().mockResolvedValue({
        data: {
          documents: [
            { documentType: 'terms_of_service', currentVersion: '2026-04-09', acceptedVersion: '2025-01-01', acceptedAt: '2025-01-01T00:00:00.000Z', isUpToDate: false },
            { documentType: 'privacy_policy', currentVersion: '2026-04-09', acceptedVersion: null, acceptedAt: null, isUpToDate: false },
          ],
          allUpToDate: false,
        },
      }),
    } as unknown as ConsentService;
    const guard = new ConsentGuard(makeReflector(false), service);

    try {
      await withCtx(USER, () => guard.canActivate(buildContext()));
      expect.fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse() as {
        error: string;
        details: { pending: Array<{ documentType: string }> };
      };
      expect(body.error).toBe('ConsentRequired');
      expect(body.details.pending).toHaveLength(2);
    }
  });
});
