import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../enums/role.enum';
import { requestContext } from '../../common/context/request-context';

function createMockExecutionContext(
  user?: {
    userId: string;
    tenantId: string;
    roles: (Role | string)[];
    email: string;
  },
  overrides: { method?: string; url?: string } = {},
) {
  const request = {
    user,
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/api/v1/resource',
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let reflector: Reflector;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.restoreAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        TenantGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: vi.fn(() => undefined),
          },
        },
      ],
    }).compile();

    guard = module.get(TenantGuard);
    reflector = module.get(Reflector);
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Scenario 1: admin_tenant blocked on cross-tenant access
  it('should throw ForbiddenException for admin_tenant cross-tenant access (Scenario 1)', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: 'tenant-B',
      requestId: 'req-1',
      correlationId: 'corr-1',
    });

    const ctx = createMockExecutionContext({
      userId: 'user-123',
      tenantId: 'tenant-A',
      roles: [Role.ADMIN_TENANT],
      email: 'test@metanoia.dev',
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.access.denied',
        tenant_mismatch: true,
      }),
    );
  });

  // Scenario 2: super_admin bypasses tenant check
  it('should allow super_admin even with mismatched tenantId (Scenario 2)', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: 'tenant-B',
      requestId: 'req-1',
      correlationId: 'corr-1',
    });

    const ctx = createMockExecutionContext({
      userId: 'sa-user',
      tenantId: 'tenant-A',
      roles: [Role.SUPER_ADMIN],
      email: 'sa@metanoia.dev',
    });

    expect(guard.canActivate(ctx as any)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // Scenario 3: same-tenant access succeeds
  it('should allow lider with matching tenantId (Scenario 3)', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: 'tenant-A',
      requestId: 'req-1',
      correlationId: 'corr-1',
    });

    const ctx = createMockExecutionContext({
      userId: 'lider-1',
      tenantId: 'tenant-A',
      roles: [Role.LIDER],
      email: 'lider@metanoia.dev',
    });

    expect(guard.canActivate(ctx as any)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // Scenario 6: user_id unavailable → log uses "unknown"
  it('should log user_id as "unknown" when userId is empty (Scenario 6)', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: 'tenant-B',
      requestId: 'req-1',
      correlationId: 'corr-1',
    });

    const ctx = createMockExecutionContext({
      userId: '',
      tenantId: 'tenant-A',
      roles: [Role.ADMIN_TENANT],
      email: 'test@metanoia.dev',
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.access.denied',
        user_id: 'unknown',
        tenant_mismatch: true,
      }),
    );
  });

  // Scenario 9: fail-closed when RequestContext is unavailable
  it('should throw ForbiddenException when requestContext.getStore() is undefined (Scenario 9 — fail-closed)', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue(undefined);

    const ctx = createMockExecutionContext({
      userId: 'user-123',
      tenantId: 'tenant-A',
      roles: [Role.ADMIN_TENANT],
      email: 'test@metanoia.dev',
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.access.denied',
        tenant_mismatch: true,
      }),
    );
  });

  // request.user absent → 403, not 500
  it('should throw ForbiddenException (not 500) when request.user is absent', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: 'tenant-A',
      requestId: 'req-1',
      correlationId: 'corr-1',
    });

    const ctx = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });

  // @Public() bypass
  it('should return true for @Public() endpoint without checking tenant', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });

    const ctx = createMockExecutionContext(undefined);
    expect(guard.canActivate(ctx as any)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // roles=[] edge case (CHK022)
  it('should reject roles=[] user on cross-tenant (no 500 crash)', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: 'tenant-B',
      requestId: 'req-1',
      correlationId: 'corr-1',
    });

    const ctx = createMockExecutionContext({
      userId: 'user-empty',
      tenantId: 'tenant-A',
      roles: [],
      email: 'empty@metanoia.dev',
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });

  // CHK010: tenant UUIDs must NOT appear in log entries
  it('should NOT log tenant UUIDs in rejection log (CHK010, OWASP API1 BOLA)', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: 'tenant-uuid-B',
      requestId: 'req-1',
      correlationId: 'corr-1',
    });

    const ctx = createMockExecutionContext({
      userId: 'user-123',
      tenantId: 'tenant-uuid-A',
      roles: [Role.ADMIN_TENANT],
      email: 'test@metanoia.dev',
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    const logArg = warnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(logArg).not.toHaveProperty('expected_tenant');
    expect(logArg).not.toHaveProperty('actual_tenant');
    expect(JSON.stringify(logArg)).not.toContain('tenant-uuid-A');
    expect(JSON.stringify(logArg)).not.toContain('tenant-uuid-B');
  });

  // CHK011: tenant_mismatch: true appears in log
  it('should include tenant_mismatch: true in rejection log', () => {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: 'tenant-B',
      requestId: 'req-1',
      correlationId: 'corr-1',
    });

    const ctx = createMockExecutionContext({
      userId: 'user-123',
      tenantId: 'tenant-A',
      roles: [Role.ADMIN_TENANT],
      email: 'test@metanoia.dev',
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_mismatch: true,
      }),
    );
  });
});
