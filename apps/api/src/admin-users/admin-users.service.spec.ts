import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { AdminUsersService } from './admin-users.service';
import { requestContext } from '../common/context/request-context';

const TENANT = '01912345-6789-7000-8000-000000000001';
const ADMIN_USER = '01912345-6789-7000-8000-0000000000a1';
const OTHER_USER = '01912345-6789-7000-8000-0000000000a2';

function makeMembership(overrides: Partial<{ userId: string; role: string; email: string; name: string }> = {}) {
  return {
    id: generateId(),
    userId: overrides.userId ?? OTHER_USER,
    tenantId: TENANT,
    role: overrides.role ?? 'lider',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    user: {
      id: overrides.userId ?? OTHER_USER,
      email: overrides.email ?? 'lider@tenant.org',
      name: overrides.name ?? 'Líder Silva',
    },
  };
}

function createMocks() {
  const repo = {
    listMembers: vi.fn(),
    findMembership: vi.fn(),
    updateRole: vi.fn(),
    removeFromTenant: vi.fn(),
    countAdminTenants: vi.fn(),
  };
  const service = new AdminUsersService(repo as never);
  return { service, repo };
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

describe('AdminUsersService.listMembers', () => {
  it('returns paginated meta with total', async () => {
    const { service, repo } = createMocks();
    repo.listMembers.mockResolvedValue([
      makeMembership({ role: 'admin_tenant', email: 'admin@tenant.org' }),
      makeMembership({ userId: OTHER_USER, role: 'lider' }),
    ]);

    const result = await withCtx(ADMIN_USER, () => service.listMembers());
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(result.data[0]?.role).toBe('admin_tenant');
  });
});

describe('AdminUsersService.getMember', () => {
  it('throws 404 when not found', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(null);
    await expect(
      withCtx(ADMIN_USER, () => service.getMember(OTHER_USER)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminUsersService.updateRole', () => {
  let service: AdminUsersService;
  let repo: ReturnType<typeof createMocks>['repo'];

  beforeEach(() => {
    ({ service, repo } = createMocks());
  });

  it('promotes lider to admin_tenant', async () => {
    repo.findMembership.mockResolvedValue(
      makeMembership({ userId: OTHER_USER, role: 'lider' }),
    );
    repo.updateRole.mockResolvedValue(
      makeMembership({ userId: OTHER_USER, role: 'admin_tenant' }),
    );

    const result = await withCtx(ADMIN_USER, () =>
      service.updateRole(OTHER_USER, { role: 'admin_tenant' }),
    );
    expect(result.data.role).toBe('admin_tenant');
    expect(repo.updateRole).toHaveBeenCalledWith(OTHER_USER, 'admin_tenant');
  });

  it('blocks self-demotion when last admin_tenant', async () => {
    repo.findMembership.mockResolvedValue(
      makeMembership({ userId: ADMIN_USER, role: 'admin_tenant' }),
    );
    repo.countAdminTenants.mockResolvedValue(1);

    await expect(
      withCtx(ADMIN_USER, () =>
        service.updateRole(ADMIN_USER, { role: 'lider' }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it('allows self-demotion when there is another admin_tenant', async () => {
    repo.findMembership.mockResolvedValue(
      makeMembership({ userId: ADMIN_USER, role: 'admin_tenant' }),
    );
    repo.countAdminTenants.mockResolvedValue(2);
    repo.updateRole.mockResolvedValue(
      makeMembership({ userId: ADMIN_USER, role: 'lider' }),
    );

    const result = await withCtx(ADMIN_USER, () =>
      service.updateRole(ADMIN_USER, { role: 'lider' }),
    );
    expect(result.data.role).toBe('lider');
  });

  it('demotes someone else without checking self-protection', async () => {
    repo.findMembership.mockResolvedValue(
      makeMembership({ userId: OTHER_USER, role: 'admin_tenant' }),
    );
    repo.updateRole.mockResolvedValue(
      makeMembership({ userId: OTHER_USER, role: 'lider' }),
    );

    const result = await withCtx(ADMIN_USER, () =>
      service.updateRole(OTHER_USER, { role: 'lider' }),
    );
    expect(result.data.role).toBe('lider');
    // countAdminTenants is NOT called when demoting another user.
    expect(repo.countAdminTenants).not.toHaveBeenCalled();
  });

  it('throws 404 when user not found in tenant', async () => {
    repo.findMembership.mockResolvedValue(null);
    await expect(
      withCtx(ADMIN_USER, () =>
        service.updateRole(OTHER_USER, { role: 'lider' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminUsersService.removeFromTenant', () => {
  it('blocks self-removal when last admin_tenant', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(
      makeMembership({ userId: ADMIN_USER, role: 'admin_tenant' }),
    );
    repo.countAdminTenants.mockResolvedValue(1);

    await expect(
      withCtx(ADMIN_USER, () => service.removeFromTenant(ADMIN_USER)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.removeFromTenant).not.toHaveBeenCalled();
  });

  it('removes a regular member', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(
      makeMembership({ userId: OTHER_USER, role: 'lider' }),
    );
    repo.removeFromTenant.mockResolvedValue(undefined);

    await withCtx(ADMIN_USER, () => service.removeFromTenant(OTHER_USER));
    expect(repo.removeFromTenant).toHaveBeenCalledWith(OTHER_USER);
  });

  it('throws 404 when user not in tenant', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(null);
    await expect(
      withCtx(ADMIN_USER, () => service.removeFromTenant(OTHER_USER)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
