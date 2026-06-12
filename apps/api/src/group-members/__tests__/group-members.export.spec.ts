import { describe, it, expect, vi } from 'vitest';
import { GroupMembersService } from '../group-members.service';

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const GROUP_ID = '01912345-6789-7000-8000-000000000010';

function makePrisma(memberships: unknown[]) {
  return {
    client: {
      groupMember: { findMany: vi.fn().mockResolvedValue(memberships) },
    },
  };
}

function makeService(prisma: unknown) {
  return new GroupMembersService(
    {} as never, // repo — not used by exportUserData
    {} as never, // planLimits — not used by exportUserData
    prisma as never,
  );
}

describe('GroupMembersService.exportUserData', () => {
  it('returns memberships with ISO 8601 joinedAt', async () => {
    const rows = [
      {
        groupId: GROUP_ID,
        role: 'membro',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        group: { name: 'Células Norte' },
      },
    ];
    const prisma = makePrisma(rows);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.memberships).toHaveLength(1);
    expect(result.memberships[0].groupId).toBe(GROUP_ID);
    expect(result.memberships[0].groupName).toBe('Células Norte');
    expect(result.memberships[0].role).toBe('membro');
    expect(result.memberships[0].joinedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('returns empty memberships when user has no groups', async () => {
    const prisma = makePrisma([]);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.memberships).toHaveLength(0);
  });

  it('passes correct where clause to prisma', async () => {
    const prisma = makePrisma([]);
    const svc = makeService(prisma);

    await svc.exportUserData(USER_ID, TENANT_ID);

    expect(prisma.client.groupMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, tenantId: TENANT_ID },
      }),
    );
  });

  it('maps groupName from group relation', async () => {
    const rows = [
      {
        groupId: GROUP_ID,
        role: 'lider',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        group: { name: 'Líderes' },
      },
    ];
    const prisma = makePrisma(rows);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.memberships[0].groupName).toBe('Líderes');
  });
});
