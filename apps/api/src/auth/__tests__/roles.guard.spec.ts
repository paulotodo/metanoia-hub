import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RolesGuard } from '../roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../enums/role.enum';

function createMockExecutionContext(user?: {
  userId: string;
  tenantId: string;
  roles: (Role | string)[];
  email: string;
}) {
  const request = {
    user,
    method: 'GET',
    url: '/api/v1/test',
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

const defaultUser = {
  userId: 'user-123',
  tenantId: 'tenant-001',
  roles: [] as (Role | string)[],
  email: 'test@metanoia.dev',
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.restoreAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: vi.fn(() => undefined),
          },
        },
      ],
    }).compile();

    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('should allow access when user has the required role', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.LIDER];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: [Role.LIDER, Role.PARTICIPANTE],
    });

    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks the required role', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.SUPER_ADMIN];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: [Role.PARTICIPANTE],
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });

  it('should allow access when no roles are required (no decorator)', () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: [Role.PARTICIPANTE],
    });

    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('should allow access when user has any of multiple required roles (OR logic)', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.ADMIN_TENANT, Role.SUPER_ADMIN];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: [Role.ADMIN_TENANT],
    });

    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('should throw ForbiddenException when user has no matching roles', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.LIDER];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: [],
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });

  it('should throw UnauthorizedException when user is not authenticated', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.LIDER];
      return undefined;
    });
    const ctx = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(ctx as any)).toThrow(
      UnauthorizedException,
    );
  });

  it('should allow access on @Public() endpoint even with @Roles() and no user', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.LIDER];
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    const ctx = createMockExecutionContext(undefined);

    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('should emit structured log with action, user_id, endpoint when rejecting (subtarefa 2.1.6)', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.ADMIN_TENANT];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      userId: 'user-abc',
      roles: [Role.PARTICIPANTE],
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.access.denied',
        user_id: 'user-abc',
        endpoint: 'GET /api/v1/test',
        required_role: [Role.ADMIN_TENANT],
      }),
    );
  });

  it('should log user_id as "unknown" when userId is empty (subtarefa 2.1.7, Scenario 6)', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.ADMIN_TENANT];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      userId: '',
      roles: [Role.PARTICIPANTE],
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.access.denied',
        user_id: 'unknown',
      }),
    );
  });

  it('should not include JWT or email in log entry (CHK009)', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.ADMIN_TENANT];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: [Role.PARTICIPANTE],
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    const logCall = warnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(logCall).not.toHaveProperty('email');
    expect(logCall).not.toHaveProperty('token');
    expect(logCall).not.toHaveProperty('jwt');
  });
});
