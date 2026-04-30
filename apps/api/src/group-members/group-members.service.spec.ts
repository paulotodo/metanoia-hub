import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { GroupMembersService } from './group-members.service';
import { requestContext } from '../common/context/request-context';

const TENANT = '01912345-6789-7000-8000-000000000001';
const GROUP = '01912345-6789-7000-8000-000000000100';
const USER_A = '01912345-6789-7000-8000-0000000000a1';
const USER_B = '01912345-6789-7000-8000-0000000000a2';

function buildMembership(overrides: Partial<{ id: string; userId: string; role: string; name: string; email: string; }> = {}) {
  return {
    id: overrides.id ?? generateId(),
    groupId: GROUP,
    userId: overrides.userId ?? USER_A,
    tenantId: TENANT,
    role: overrides.role ?? 'membro',
    createdAt: new Date('2026-04-30T00:00:00.000Z'),
    user: {
      id: overrides.userId ?? USER_A,
      name: overrides.name ?? 'Maria',
      email: overrides.email ?? 'maria@tenant.org',
    },
  };
}

function createMocks() {
  const repo = {
    findGroupById: vi.fn().mockResolvedValue({ id: GROUP, tenantId: TENANT }),
    listByGroup: vi.fn(),
    findMembership: vi.fn(),
    countByGroup: vi.fn().mockResolvedValue(0),
    countLeadersInTenant: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
    findUserInTenant: vi.fn().mockResolvedValue({ userId: USER_A, tenantId: TENANT }),
  };
  const planLimits = {
    getPlan: vi.fn().mockResolvedValue('free'),
  };
  const service = new GroupMembersService(repo as never, planLimits as never);
  return { service, repo, planLimits };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT,
      userId: USER_A,
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('GroupMembersService.list', () => {
  it('returns members + leaderCount meta', async () => {
    const { service, repo } = createMocks();
    repo.listByGroup.mockResolvedValue([
      buildMembership({ role: 'lider' }),
      buildMembership({ userId: USER_B, role: 'membro', email: 'joao@x.org' }),
    ]);
    const result = await withCtx(() => service.list(GROUP));
    expect(result.data).toHaveLength(2);
    expect(result.meta.leaderCount).toBe(1);
  });

  it('throws 404 when group missing', async () => {
    const { service, repo } = createMocks();
    repo.findGroupById.mockResolvedValue(null);
    await expect(
      withCtx(() => service.list(GROUP)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GroupMembersService.add', () => {
  let mocks: ReturnType<typeof createMocks>;
  beforeEach(() => {
    mocks = createMocks();
  });

  it('adds a regular membro', async () => {
    mocks.repo.findMembership.mockResolvedValue(null);
    mocks.repo.create.mockResolvedValue(buildMembership({ role: 'membro' }));

    const result = await withCtx(() =>
      mocks.service.add(GROUP, { userId: USER_A, role: 'membro' }),
    );
    expect(result.data.role).toBe('membro');
  });

  it('rejects duplicate membership with 409', async () => {
    mocks.repo.findMembership.mockResolvedValue(buildMembership());
    await expect(
      withCtx(() => mocks.service.add(GROUP, { userId: USER_A, role: 'membro' })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects user that does not belong to tenant', async () => {
    mocks.repo.findMembership.mockResolvedValue(null);
    mocks.repo.findUserInTenant.mockResolvedValue(null);
    await expect(
      withCtx(() => mocks.service.add(GROUP, { userId: USER_A, role: 'membro' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks add when group reached membersPerGroup cap', async () => {
    mocks.repo.findMembership.mockResolvedValue(null);
    mocks.repo.countByGroup.mockResolvedValue(30); // free cap = 30
    await expect(
      withCtx(() => mocks.service.add(GROUP, { userId: USER_A, role: 'membro' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks lider promotion when leadersPerTenant cap reached', async () => {
    mocks.repo.findMembership.mockResolvedValue(null);
    mocks.repo.countLeadersInTenant.mockResolvedValue(5); // free cap = 5
    await expect(
      withCtx(() => mocks.service.add(GROUP, { userId: USER_A, role: 'lider' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows lider promotion when below cap', async () => {
    mocks.repo.findMembership.mockResolvedValue(null);
    mocks.repo.countLeadersInTenant.mockResolvedValue(2);
    mocks.repo.create.mockResolvedValue(buildMembership({ role: 'lider' }));
    const result = await withCtx(() =>
      mocks.service.add(GROUP, { userId: USER_A, role: 'lider' }),
    );
    expect(result.data.role).toBe('lider');
  });
});

describe('GroupMembersService.updateRole', () => {
  it('promotes to lider when below cap', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(buildMembership({ role: 'membro' }));
    repo.countLeadersInTenant.mockResolvedValue(2);
    repo.updateRole.mockResolvedValue(buildMembership({ role: 'lider' }));
    const result = await withCtx(() =>
      service.updateRole(GROUP, USER_A, { role: 'lider' }),
    );
    expect(result.data.role).toBe('lider');
  });

  it('rejects promotion when leadersPerTenant cap reached', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(buildMembership({ role: 'membro' }));
    repo.countLeadersInTenant.mockResolvedValue(5);
    await expect(
      withCtx(() => service.updateRole(GROUP, USER_A, { role: 'lider' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns same when role is unchanged', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(buildMembership({ role: 'membro' }));
    const result = await withCtx(() =>
      service.updateRole(GROUP, USER_A, { role: 'membro' }),
    );
    expect(result.data.role).toBe('membro');
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it('throws 404 when membership missing', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(null);
    await expect(
      withCtx(() => service.updateRole(GROUP, USER_A, { role: 'lider' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GroupMembersService.remove', () => {
  it('removes existing membership', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(buildMembership());
    await expect(
      withCtx(() => service.remove(GROUP, USER_A)),
    ).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalled();
  });

  it('throws 404 when membership missing', async () => {
    const { service, repo } = createMocks();
    repo.findMembership.mockResolvedValue(null);
    await expect(
      withCtx(() => service.remove(GROUP, USER_A)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
