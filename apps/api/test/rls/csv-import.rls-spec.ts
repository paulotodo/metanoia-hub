import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

/**
 * RLS Isolation for CSV import — Story 10-4.
 *
 * Verifies that users and group_members created via CSV import for Tenant A
 * are not visible to Tenant B through RLS policies.
 *
 * Pattern: group-members.rls-spec.ts
 * Notes:
 *   - users table has tenant_id nullable (global users), but user_tenants binds them.
 *   - group_members has tenant_id (enforced via RLS policy).
 *   - No updated_at on group_members (column does not exist).
 *   - UUIDs are fixed hex strings (not random) to avoid test flakiness.
 *   - PrismaPg adapter required for Prisma v7.
 */

// ─── Fixed hex UUIDs ─────────────────────────────────────────────────────────
// Users for CSV import simulation
const IMPORT_USER_A_ID = '01912345-6789-7000-8000-00000000d001';
const IMPORT_USER_B_ID = '01912345-6789-7000-8000-00000000d002';
// Users that belong to each tenant (used as owners/admins)
const ALICE_A_ID = '01912345-6789-7000-8000-00000000d010';
const BOB_B_ID   = '01912345-6789-7000-8000-00000000d011';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureGlobalUser(
  prisma: PrismaClient,
  userId: string,
  email: string,
  name: string,
  tenantCtx: string,
) {
  // Users are global (no tenant_id filter in users RLS for insert).
  // We use tenantCtx only to satisfy the RLS app.current_tenant_id requirement.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, updated_at)
       VALUES ('${userId}'::uuid, '${email}', '${name}', 'active', NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function bindUserToTenant(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO user_tenants (id, user_id, tenant_id, role)
       VALUES ('${generateId()}'::uuid, '${userId}'::uuid, '${tenantId}'::uuid, 'participante')
       ON CONFLICT (user_id, tenant_id) DO NOTHING`,
    );
  });
}

async function createGroupWithMember(
  prisma: PrismaClient,
  tenantId: string,
  groupName: string,
  userId: string,
) {
  const groupId = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.group.create({
      data: {
        id: groupId,
        tenantId,
        name: groupName,
        dayOfWeek: 'sat',
        time: '10:00',
        recurrence: 'weekly',
        notes: null,
      },
    });
    await tx.groupMember.create({
      data: {
        id: generateId(),
        tenantId,
        groupId,
        userId,
        role: 'participante',
      },
    });
  });
  return groupId;
}

async function countUserTenantsForUser(
  prisma: PrismaClient,
  tenantCtx: string,
  userId: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.userTenant.count({ where: { userId } });
  });
}

async function countGroupMembersInTenant(
  prisma: PrismaClient,
  tenantCtx: string,
  groupId: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.groupMember.count({ where: { groupId } });
  });
}

async function cleanup(prisma: PrismaClient, groupNames: string[], userIds: string[]) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      const nameList = groupNames.map((n) => `'${n}'`).join(',');
      await tx.$executeRawUnsafe(
        `DELETE FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE name IN (${nameList}))`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM groups WHERE name IN (${nameList})`,
      );
    });
  }
  // user_tenants and users are not RLS-filtered in cleanup — use bypass
  if (userIds.length > 0) {
    const idList = userIds.map((id) => `'${id}'::uuid`).join(',');
    for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
        await tx.$executeRawUnsafe(
          `DELETE FROM user_tenants WHERE user_id IN (${idList})`,
        );
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      await tx.$executeRawUnsafe(
        `DELETE FROM users WHERE id IN (${idList})`,
      );
    });
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('RLS Isolation: CSV import (user_tenants + group_members)', () => {
  let prisma: PrismaClient;

  const GROUP_A_NAME = 'rls-csv-import-tenant-a-group';
  const GROUP_B_NAME = 'rls-csv-import-tenant-b-group';

  const ALL_USER_IDS = [
    IMPORT_USER_A_ID,
    IMPORT_USER_B_ID,
    ALICE_A_ID,
    BOB_B_ID,
  ];

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');

    // Create two global users that will be "imported" into tenant A
    await ensureGlobalUser(prisma, IMPORT_USER_A_ID, 'import-a@rls-csv.test', 'Import User A', TENANT_A_ID);
    await ensureGlobalUser(prisma, IMPORT_USER_B_ID, 'import-b@rls-csv.test', 'Import User B', TENANT_A_ID);
    // Create users that belong to each tenant's admin
    await ensureGlobalUser(prisma, ALICE_A_ID, 'alice-csv@rls.test', 'Alice CSV', TENANT_A_ID);
    await ensureGlobalUser(prisma, BOB_B_ID, 'bob-csv@rls.test', 'Bob CSV', TENANT_B_ID);
  });

  beforeEach(async () => {
    await cleanup(prisma, [GROUP_A_NAME, GROUP_B_NAME], [IMPORT_USER_A_ID, IMPORT_USER_B_ID]);
  });

  afterAll(async () => {
    await cleanup(prisma, [GROUP_A_NAME, GROUP_B_NAME], ALL_USER_IDS);
    await prisma.$disconnect();
  });

  it('SC#3 — user_tenants: binding created for Tenant A import is not visible to Tenant B context', async () => {
    // Simulate: CSV import for Tenant A creates user_tenant for IMPORT_USER_A
    await bindUserToTenant(prisma, IMPORT_USER_A_ID, TENANT_A_ID);

    // Tenant A context can see the binding
    const countFromA = await countUserTenantsForUser(prisma, TENANT_A_ID, IMPORT_USER_A_ID);
    expect(countFromA).toBeGreaterThanOrEqual(1);

    // Tenant B context cannot see the binding (RLS on user_tenants by tenant_id)
    const countFromB = await countUserTenantsForUser(prisma, TENANT_B_ID, IMPORT_USER_A_ID);
    expect(countFromB).toBe(0);
  });

  it('SC#3 — group_members: members added by import in Tenant A invisible to Tenant B', async () => {
    // First bind the user so we can create group membership
    await bindUserToTenant(prisma, IMPORT_USER_A_ID, TENANT_A_ID);

    const groupAId = await createGroupWithMember(
      prisma,
      TENANT_A_ID,
      GROUP_A_NAME,
      IMPORT_USER_A_ID,
    );

    // Tenant A can see the member in its own group
    const visibleInA = await countGroupMembersInTenant(prisma, TENANT_A_ID, groupAId);
    expect(visibleInA).toBeGreaterThanOrEqual(1);

    // Tenant B cannot see members of Tenant A's group
    const visibleInB = await countGroupMembersInTenant(prisma, TENANT_B_ID, groupAId);
    expect(visibleInB).toBe(0);
  });

  it('SC#3 — cross-tenant: imports for Tenant B do not leak to Tenant A context', async () => {
    // Bind IMPORT_USER_B to Tenant B
    await bindUserToTenant(prisma, IMPORT_USER_B_ID, TENANT_B_ID);

    const groupBId = await createGroupWithMember(
      prisma,
      TENANT_B_ID,
      GROUP_B_NAME,
      IMPORT_USER_B_ID,
    );

    // Tenant B sees its own member
    const inB = await countGroupMembersInTenant(prisma, TENANT_B_ID, groupBId);
    expect(inB).toBeGreaterThanOrEqual(1);

    // Tenant A cannot see Tenant B's group member
    const fromA = await countGroupMembersInTenant(prisma, TENANT_A_ID, groupBId);
    expect(fromA).toBe(0);
  });

  it('SC#3 — two imports: each tenant isolates its own user_tenant bindings', async () => {
    await bindUserToTenant(prisma, IMPORT_USER_A_ID, TENANT_A_ID);
    await bindUserToTenant(prisma, IMPORT_USER_B_ID, TENANT_B_ID);

    // Tenant A sees only its own binding
    const aSeesA = await countUserTenantsForUser(prisma, TENANT_A_ID, IMPORT_USER_A_ID);
    const aSeesB = await countUserTenantsForUser(prisma, TENANT_A_ID, IMPORT_USER_B_ID);

    // Tenant B sees only its own binding
    const bSeesB = await countUserTenantsForUser(prisma, TENANT_B_ID, IMPORT_USER_B_ID);
    const bSeesA = await countUserTenantsForUser(prisma, TENANT_B_ID, IMPORT_USER_A_ID);

    expect(aSeesA).toBeGreaterThanOrEqual(1);
    expect(aSeesB).toBe(0); // Tenant A cannot see Tenant B's binding
    expect(bSeesB).toBeGreaterThanOrEqual(1);
    expect(bSeesA).toBe(0); // Tenant B cannot see Tenant A's binding
  });
});
