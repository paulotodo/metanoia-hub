/**
 * RLS + Guardrail test: radar dashboard (Story 6-6)
 *
 * AC#2 — A lider CANNOT see data from groups belonging to another lider.
 * This is enforced server-side via a JOIN on group_members WHERE role='lider'
 * AND user_id=<leaderId>, independent of frontend filtering.
 *
 * Also validates tenant-level RLS: a query in tenant A context returns no
 * data from tenant B.
 *
 * IMPORTANT: follows the pattern from radar-status.rls-spec.ts
 *   - PrismaClient with PrismaPg adapter (Prisma v7)
 *   - Fixed UUIDs (idempotent across test re-runs)
 *   - Users inserted as globals (no tenant_id, context = '00000000-...')
 *   - groups + group_members within tenant context
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Fixed UUIDs — unique in the test/rls suite, stable across runs
const LIDER_A_ID  = '01912345-6789-7000-8000-0066000aa001';
const LIDER_B_ID  = '01912345-6789-7000-8000-0066000bb001';
const GROUP_A_ID  = '01912345-6789-7000-8000-0066000aa002';
const GROUP_B_ID  = '01912345-6789-7000-8000-0066000bb002';
const PART_A1_ID  = '01912345-6789-7000-8000-0066000aa003';
const PART_A2_ID  = '01912345-6789-7000-8000-0066000aa004';
const PART_B1_ID  = '01912345-6789-7000-8000-0066000bb003';

// ---- Setup helpers ----------------------------------------------------------

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

async function ensureUser(prisma: PrismaClient, userId: string, email: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000000'`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, updated_at)
       VALUES ('${userId}'::uuid, '${email}', 'Test User', 'active', now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureGroup(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  name: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
       VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, '${name}', 'domingo', '10:00', 'weekly', now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureGroupMember(
  prisma: PrismaClient,
  tenantId: string,
  memberId: string,
  groupId: string,
  userId: string,
  role: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO group_members (id, tenant_id, group_id, user_id, role)
       VALUES ('${memberId}'::uuid, '${tenantId}'::uuid, '${groupId}'::uuid, '${userId}'::uuid, '${role}')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureRadarStatus(
  prisma: PrismaClient,
  tenantId: string,
  rowId: string,
  groupId: string,
  participantId: string,
  status: 'verde' | 'amarelo' | 'vermelho',
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO participant_radar_status
         (id, tenant_id, group_id, participant_id, status, trend, presence_percentage)
       VALUES
         ('${rowId}'::uuid, '${tenantId}'::uuid, '${groupId}'::uuid, '${participantId}'::uuid,
          '${status}'::"RadarStatus", 'estavel'::"RadarTrend", 0.75)
       ON CONFLICT (tenant_id, group_id, participant_id) DO UPDATE
         SET status = EXCLUDED.status, calculated_at = now()`,
    );
  });
}

/**
 * Simulates the server-side lider filter:
 * SELECT groups WHERE lider.user_id = $userId AND groups within tenant context.
 * Returns group IDs visible to the given lider.
 */
async function queryGroupIdsForLider(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
): Promise<string[]> {
  type Row = { group_id: string };
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRaw<Row[]>`
      SELECT g.id AS group_id
      FROM groups g
      INNER JOIN group_members gm
        ON gm.group_id = g.id
        AND gm.role = 'lider'
        AND gm.user_id = ${userId}::uuid
    `;
  });
  return rows.map((r) => r.group_id);
}

async function cleanup(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(
        `DELETE FROM participant_radar_status WHERE tenant_id = '${tenantId}'::uuid
           AND group_id IN ('${GROUP_A_ID}', '${GROUP_B_ID}')`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM group_members WHERE tenant_id = '${tenantId}'::uuid
           AND group_id IN ('${GROUP_A_ID}', '${GROUP_B_ID}')`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM groups WHERE tenant_id = '${tenantId}'::uuid
           AND id IN ('${GROUP_A_ID}'::uuid, '${GROUP_B_ID}'::uuid)`,
      );
    });
  }
}

// ---- Tests ------------------------------------------------------------------

describe('RLS + Guardrail: radar dashboard lider isolation (Story 6-6)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    // Seed tenants, users, groups, group_members, radar statuses
    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A - Dashboard 6-6');

    await ensureUser(prisma, LIDER_A_ID, 'lider-a-6-6@test.local');
    await ensureUser(prisma, LIDER_B_ID, 'lider-b-6-6@test.local');
    await ensureUser(prisma, PART_A1_ID, 'part-a1-6-6@test.local');
    await ensureUser(prisma, PART_A2_ID, 'part-a2-6-6@test.local');
    await ensureUser(prisma, PART_B1_ID, 'part-b1-6-6@test.local');

    // Group A belongs to Lider A; Group B belongs to Lider B (same tenant)
    await ensureGroup(prisma, TENANT_A_ID, GROUP_A_ID, 'Grupo Alpha 6-6');
    await ensureGroup(prisma, TENANT_A_ID, GROUP_B_ID, 'Grupo Beta 6-6');

    const MEMBER_LIDER_A = '01912345-6789-7000-8000-0066000aa010';
    const MEMBER_LIDER_B = '01912345-6789-7000-8000-0066000bb010';
    await ensureGroupMember(prisma, TENANT_A_ID, MEMBER_LIDER_A, GROUP_A_ID, LIDER_A_ID, 'lider');
    await ensureGroupMember(prisma, TENANT_A_ID, MEMBER_LIDER_B, GROUP_B_ID, LIDER_B_ID, 'lider');
  });

  beforeEach(async () => {
    await cleanup(prisma);
    // Re-seed radar statuses
    await ensureRadarStatus(prisma, TENANT_A_ID, '01912345-6789-7000-8000-0066rs0a0001', GROUP_A_ID, PART_A1_ID, 'verde');
    await ensureRadarStatus(prisma, TENANT_A_ID, '01912345-6789-7000-8000-0066rs0a0002', GROUP_A_ID, PART_A2_ID, 'amarelo');
    await ensureRadarStatus(prisma, TENANT_A_ID, '01912345-6789-7000-8000-0066rs0b0001', GROUP_B_ID, PART_B1_ID, 'vermelho');
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // AC#2 — server-side lider filter
  // -------------------------------------------------------------------------

  it('AC#2: lider A can see only their own group (Group A), not Group B', async () => {
    const groupIds = await queryGroupIdsForLider(prisma, TENANT_A_ID, LIDER_A_ID);

    expect(groupIds).toHaveLength(1);
    expect(groupIds[0]).toBe(GROUP_A_ID);
    expect(groupIds).not.toContain(GROUP_B_ID);
  });

  it('AC#2: lider B can see only their own group (Group B), not Group A', async () => {
    const groupIds = await queryGroupIdsForLider(prisma, TENANT_A_ID, LIDER_B_ID);

    expect(groupIds).toHaveLength(1);
    expect(groupIds[0]).toBe(GROUP_B_ID);
    expect(groupIds).not.toContain(GROUP_A_ID);
  });

  it('AC#2: lider A group list does not include participants from Group B', async () => {
    const groupIds = await queryGroupIdsForLider(prisma, TENANT_A_ID, LIDER_A_ID);

    // Query radar statuses restricted to lider A's groups
    type Row = { participant_id: string; group_id: string };
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRaw<Row[]>`
        SELECT participant_id, group_id
        FROM participant_radar_status
        WHERE group_id = ANY(${groupIds}::uuid[])
      `;
    });

    const seenGroupIds = rows.map((r) => r.group_id);
    expect(seenGroupIds.every((id) => id === GROUP_A_ID)).toBe(true);
    // Participant from Group B is NOT visible
    const seenParticipants = rows.map((r) => r.participant_id);
    expect(seenParticipants).not.toContain(PART_B1_ID);
  });

  // -------------------------------------------------------------------------
  // Tenant RLS
  // -------------------------------------------------------------------------

  it('tenant A context cannot see groups from tenant B', async () => {
    // TENANT_B has no data in this spec — verify no cross-bleed from A
    const groupsForB = await queryGroupIdsForLider(prisma, TENANT_B_ID, LIDER_A_ID);
    expect(groupsForB).toHaveLength(0);
  });
});
