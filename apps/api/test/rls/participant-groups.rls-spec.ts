import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

/**
 * RLS + membership isolation for the participant-side group queries.
 *
 * The participant-groups repository combines two layers of access control:
 *  1. Postgres RLS on `groups`/`group_members` (tenant isolation).
 *  2. Application-level WHERE on `members.some.userId` (membership check).
 *
 * This spec validates BOTH layers for the queries used by the participant-side
 * service: `findGroupsForUser` and `findGroupForUser`.
 */

const ALICE_ID = '01912345-6789-7000-8000-00000000a001';
const BOB_ID = '01912345-6789-7000-8000-00000000a002';
const CARLA_ID = '01912345-6789-7000-8000-00000000b001';

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureUser(
  prisma: PrismaClient,
  userId: string,
  email: string,
  name: string,
  tenantId: string,
) {
  // Users have FORCE RLS; insert inside a tenant tx with the matching
  // tenant_id so the WITH CHECK policy is satisfied.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, tenant_id, created_at, updated_at)
       VALUES ('${userId}'::uuid, '${email}', '${name}', 'active', '${tenantId}'::uuid, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedGroupWithMembers(
  prisma: PrismaClient,
  tenantId: string,
  name: string,
  memberUserIds: string[],
) {
  const groupId = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.group.create({
      data: {
        id: groupId,
        tenantId,
        name,
        dayOfWeek: 'wed',
        time: '19:30',
        recurrence: 'weekly',
        notes: null,
      },
    });
    for (const userId of memberUserIds) {
      await tx.groupMember.create({
        data: {
          id: generateId(),
          tenantId,
          groupId,
          userId,
          role: 'membro',
        },
      });
    }
  });
  return groupId;
}

async function findGroupsForUser(
  prisma: PrismaClient,
  tenantCtx: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.group.findMany({
      where: { members: { some: { userId } } },
    });
  });
}

async function findGroupForUser(
  prisma: PrismaClient,
  tenantCtx: string,
  groupId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.group.findFirst({
      where: { id: groupId, members: { some: { userId } } },
    });
  });
}

async function cleanupGroups(prisma: PrismaClient, names: string[]) {
  const list = names.map((n) => `'${n}'`).join(',');
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE name IN (${list}))`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM groups WHERE name IN (${list})`,
      );
    });
  }
}

describe('RLS + membership isolation: participant groups queries', () => {
  let prisma: PrismaClient;
  const aliceGroupName = 'rls-pg-alice-group';
  const bobOnlyGroupName = 'rls-pg-bob-only-group';
  const carlaGroupName = 'rls-pg-carla-group';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, ALICE_ID, 'alice@rls.test', 'Alice Test', TENANT_A_ID);
    await ensureUser(prisma, BOB_ID, 'bob@rls.test', 'Bob Test', TENANT_A_ID);
    await ensureUser(prisma, CARLA_ID, 'carla@rls.test', 'Carla Test', TENANT_B_ID);
  });

  beforeEach(async () => {
    await cleanupGroups(prisma, [
      aliceGroupName,
      bobOnlyGroupName,
      carlaGroupName,
    ]);
  });

  afterAll(async () => {
    await cleanupGroups(prisma, [
      aliceGroupName,
      bobOnlyGroupName,
      carlaGroupName,
    ]);
    await prisma.$disconnect();
  });

  it('findGroupsForUser only returns groups where the user is a member (within tenant)', async () => {
    await seedGroupWithMembers(prisma, TENANT_A_ID, aliceGroupName, [ALICE_ID]);
    await seedGroupWithMembers(prisma, TENANT_A_ID, bobOnlyGroupName, [BOB_ID]);

    const aliceGroups = await findGroupsForUser(prisma, TENANT_A_ID, ALICE_ID);

    expect(aliceGroups.some((g) => g.name === aliceGroupName)).toBe(true);
    expect(aliceGroups.some((g) => g.name === bobOnlyGroupName)).toBe(false);
  });

  it('findGroupsForUser does NOT return groups from another tenant even if the user is a member there', async () => {
    await seedGroupWithMembers(prisma, TENANT_B_ID, carlaGroupName, [CARLA_ID]);

    // Carla is a member of carlaGroup, but we query in tenant A's context.
    const visibleInA = await findGroupsForUser(prisma, TENANT_A_ID, CARLA_ID);

    expect(visibleInA.some((g) => g.name === carlaGroupName)).toBe(false);
  });

  it('findGroupForUser returns null when the user is not a member of the group', async () => {
    const bobGroupId = await seedGroupWithMembers(
      prisma,
      TENANT_A_ID,
      bobOnlyGroupName,
      [BOB_ID],
    );

    const result = await findGroupForUser(prisma, TENANT_A_ID, bobGroupId, ALICE_ID);

    expect(result).toBeNull();
  });

  it('findGroupForUser returns null for a group in a different tenant (RLS blocks it)', async () => {
    const carlaGroupId = await seedGroupWithMembers(
      prisma,
      TENANT_B_ID,
      carlaGroupName,
      [CARLA_ID],
    );

    // Even though carlaUser is "a member", we query as tenant A — RLS hides
    // the group entirely.
    const result = await findGroupForUser(
      prisma,
      TENANT_A_ID,
      carlaGroupId,
      CARLA_ID,
    );

    expect(result).toBeNull();
  });
});
