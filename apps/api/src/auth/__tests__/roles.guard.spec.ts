import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RolesGuard } from '../roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function createMockExecutionContext(user?: {
  userId: string;
  tenantId: string;
  roles: string[];
  email: string;
}) {
  const request = { user };

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
  roles: [] as string[],
  email: 'test@metanoia.dev',
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

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
  });

  it('should allow access when user has the required role', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return ['lider'];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: ['lider', 'participante'],
    });

    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks the required role', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return ['super_admin'];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: ['participante'],
    });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });

  it('should allow access when no roles are required (no decorator)', () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: ['participante'],
    });

    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('should allow access when user has any of multiple required roles (OR logic)', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return ['admin_tenant', 'super_admin'];
      return undefined;
    });
    const ctx = createMockExecutionContext({
      ...defaultUser,
      roles: ['admin_tenant'],
    });

    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('should throw ForbiddenException when user has no matching roles', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return ['lider'];
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
      if (key === ROLES_KEY) return ['lider'];
      return undefined;
    });
    const ctx = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(ctx as any)).toThrow(
      UnauthorizedException,
    );
  });

  it('should allow access on @Public() endpoint even with @Roles() and no user', () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return ['lider'];
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    const ctx = createMockExecutionContext(undefined);

    expect(guard.canActivate(ctx as any)).toBe(true);
  });
});
