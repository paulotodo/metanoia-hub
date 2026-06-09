/**
 * Integration tests: 3-layer authorization chain
 *
 * Scope: validates the guard chain (StubKeycloakGuard → RolesGuard → TenantGuard)
 * in the order they are registered via APP_GUARD.
 *
 * Strategy: KeycloakAuthGuard is stubbed (its JWT verification is tested in
 * keycloak.guard.spec.ts). Focuses on the role + tenant isolation layers.
 * Guards are called sequentially via a test ExecutionContext, simulating the
 * NestJS guard chain without starting an HTTP server.
 *
 * Ref: spec.md §FR-05, §P4, quickstart.md §Scenario 5, research.md Decision 5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { RolesGuard } from '../roles.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { requestContext } from '../../common/context/request-context';

/**
 * Factory: AuthenticatedUser for test fixtures.
 * All factories include tenantId (constitution Principe VI).
 */
function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-test',
    tenantId: 'tenant-A',
    roles: [Role.ADMIN_TENANT],
    email: 'test@metanoia.dev',
    ...overrides,
  };
}

/**
 * Create a mock ExecutionContext that returns the given user and simulates
 * an endpoint with specific required roles.
 */
function makeCtx(
  user: AuthenticatedUser | undefined,
  requiredRoles: (Role | string)[] | undefined,
  opts: { method?: string; url?: string } = {},
) {
  const request = {
    user,
    method: opts.method ?? 'GET',
    url: opts.url ?? '/api/v1/resource',
  };
  const handler = {};
  const cls = {};

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => cls,
    _handler: handler,
    _class: cls,
    _requiredRoles: requiredRoles,
  };
}

describe('Auth 3-layer integration chain', () => {
  let rolesGuard: RolesGuard;
  let tenantGuard: TenantGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    vi.restoreAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        RolesGuard,
        TenantGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: vi.fn(() => undefined) },
        },
      ],
    }).compile();

    rolesGuard = module.get(RolesGuard);
    tenantGuard = module.get(TenantGuard);
    reflector = module.get(Reflector);

    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Run the guard chain sequentially (simulating NestJS APP_GUARD order):
   *   1. RolesGuard (roles check)
   *   2. TenantGuard (tenant isolation)
   *
   * Returns the ForbiddenException if thrown, or null if chain passes.
   */
  async function runChain(
    user: AuthenticatedUser | undefined,
    requiredRoles: (Role | string)[] | undefined,
    contextTenantId: string,
  ): Promise<ForbiddenException | null> {
    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: contextTenantId,
      requestId: 'req-test',
      correlationId: 'corr-test',
    });

    const ctx = makeCtx(user, requiredRoles);

    // Reflector returns required roles for @Roles() decorator
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === ROLES_KEY) return requiredRoles;
      return undefined;
    });

    try {
      await rolesGuard.canActivate(ctx as any);
      await tenantGuard.canActivate(ctx as any);
      return null;
    } catch (err) {
      if (err instanceof ForbiddenException) return err;
      throw err;
    }
  }

  // (a) super_admin passes tenant guard for any tenant (spec §FR-05-a, Quickstart Scenario 5)
  it('(a) super_admin with mismatched tenantId should pass all guards — 200', async () => {
    const user = makeUser({
      userId: 'sa-user',
      tenantId: 'tenant-A',
      roles: [Role.SUPER_ADMIN],
    });

    const err = await runChain(user, [Role.ADMIN_TENANT], 'tenant-B');
    expect(err).toBeNull();
  });

  // (b) admin_tenant for tenant-A blocked on tenant-B resource (spec §FR-05-b, Quickstart Scenario 5)
  it('(b) admin_tenant cross-tenant access should be blocked — 403', async () => {
    const user = makeUser({
      userId: 'admin-user',
      tenantId: 'tenant-A',
      roles: [Role.ADMIN_TENANT],
    });

    const err = await runChain(user, [Role.ADMIN_TENANT], 'tenant-B');
    expect(err).toBeInstanceOf(ForbiddenException);
  });

  // (c) participante blocked on admin-only endpoint (spec §FR-05-c, Quickstart Scenario 4)
  it('(c) participante blocked on admin_tenant endpoint — 403', async () => {
    const user = makeUser({
      userId: 'participante-1',
      tenantId: 'tenant-A',
      roles: [Role.PARTICIPANTE],
    });

    // RolesGuard will throw first (role check)
    const err = await runChain(user, [Role.ADMIN_TENANT], 'tenant-A');
    expect(err).toBeInstanceOf(ForbiddenException);
  });

  // (d) admin_tenant for tenant-A on tenant-A resource succeeds (spec §FR-05-d)
  it('(d) admin_tenant same-tenant access should succeed — 200', async () => {
    const user = makeUser({
      userId: 'admin-same',
      tenantId: 'tenant-A',
      roles: [Role.ADMIN_TENANT],
    });

    const err = await runChain(user, [Role.ADMIN_TENANT], 'tenant-A');
    expect(err).toBeNull();
  });

  // 403 from ForbiddenException carries { statusCode: 403, message } without stack (spec §FR-04)
  it('403 ForbiddenException should have statusCode 403 and message without stack (spec §FR-04, Scenario 8)', async () => {
    const user = makeUser({
      tenantId: 'tenant-A',
      roles: [Role.ADMIN_TENANT],
    });

    const err = await runChain(user, [Role.ADMIN_TENANT], 'tenant-B');
    expect(err).toBeInstanceOf(ForbiddenException);
    const response = (err as ForbiddenException).getResponse() as Record<string, unknown>;
    expect(response).toHaveProperty('statusCode', 403);
    expect(response).not.toHaveProperty('stack');
    expect(response).not.toHaveProperty('trace');
  });

  // super_admin realm_roles bypass (checklist CHK028, research.md Decision 5)
  it('super_admin JWT resolves tenant bypass — any tenantId mismatch (CHK028)', async () => {
    const user = makeUser({
      userId: 'sa-2',
      tenantId: 'my-own-tenant',
      roles: [Role.SUPER_ADMIN, Role.ADMIN_TENANT],
    });

    const err = await runChain(user, [Role.ADMIN_TENANT], 'completely-different-tenant');
    expect(err).toBeNull();
  });

  // Edge case: user with tenantId in token matching resource tenant (spec §FR-05)
  it('lider with matching tenant should pass both guards (spec §FR-05-d)', async () => {
    const user = makeUser({
      userId: 'lider-1',
      tenantId: 'tenant-church-1',
      roles: [Role.LIDER],
    });

    const err = await runChain(user, [Role.LIDER], 'tenant-church-1');
    expect(err).toBeNull();
  });
});
