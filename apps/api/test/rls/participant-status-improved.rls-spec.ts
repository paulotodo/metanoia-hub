import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

/** Story 6-5 — participant_status_improved RLS isolation between tenants. */

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

async function ensureUser(prisma: PrismaClient, userId: string, email: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000000'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, updated_at)
       VALUES ('${userId}'::uuid, '${email}', 'Test User', 'active', now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedStatusImproved(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  participantId: string,
  previousStatus: 'verde' | 'amarelo' | 'vermelho',
  newStatus: 'verde' | 'amarelo' | 'vermelho',
): Promise<string> {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO participant_status_improved
         (id, tenant_id, group_id, participant_id, previous_status, new_status, trend)
       VALUES
         ('${id}'::uuid, '${tenantId}'::uuid, '${groupId}'::uuid, '${participantId}'::uuid,
          '${previousStatus}'::"RadarStatus", '${newStatus}'::"RadarStatus", 'melhorando'::"RadarTrend")`,
    );
  });
  return id;
}

async function readStatusImproved(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.participantStatusImproved.findMany();
  });
}

async function cleanup(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(
        `DELETE FROM participant_status_improved WHERE tenant_id = '${tenantId}'::uuid`,
      );
    });
  }
}

describe('RLS Isolation: participant_status_improved (Story 6-5)', () => {
  let prisma: PrismaClient;

  // Use unique IDs to avoid conflicts with parallel RLS spec runs
  const groupA = '01912345-6789-7000-8000-00000000a501';
  const groupB = '01912345-6789-7000-8000-00000000b501';
  const userA  = '01912345-6789-7000-8000-00000000a5a1';
  const userB  = '01912345-6789-7000-8000-00000000b5b1';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, userA, 'usera-si@test.com');
    await ensureUser(prisma, userB, 'userb-si@test.com');
    await ensureGroup(prisma, TENANT_A_ID, groupA, 'Group A (SI)');
    await ensureGroup(prisma, TENANT_B_ID, groupB, 'Group B (SI)');
  });

  beforeEach(async () => {
    await cleanup(prisma);
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B status_improved events', async () => {
    await seedStatusImproved(prisma, TENANT_A_ID, groupA, userA, 'vermelho', 'amarelo');
    await seedStatusImproved(prisma, TENANT_B_ID, groupB, userB, 'vermelho', 'amarelo');

    const visibleToA = await readStatusImproved(prisma, TENANT_A_ID);
    expect(visibleToA.some((r) => r.participantId === userA)).toBe(true);
    expect(visibleToA.some((r) => r.participantId === userB)).toBe(false);
  });

  it('tenant B cannot see tenant A status_improved events', async () => {
    await seedStatusImproved(prisma, TENANT_A_ID, groupA, userA, 'amarelo', 'verde');
    await seedStatusImproved(prisma, TENANT_B_ID, groupB, userB, 'amarelo', 'verde');

    const visibleToB = await readStatusImproved(prisma, TENANT_B_ID);
    expect(visibleToB.some((r) => r.participantId === userB)).toBe(true);
    expect(visibleToB.some((r) => r.participantId === userA)).toBe(false);
  });

  it('seenAt starts as null and can be updated to dismiss', async () => {
    const id = await seedStatusImproved(prisma, TENANT_A_ID, groupA, userA, 'vermelho', 'verde');

    const [row] = await readStatusImproved(prisma, TENANT_A_ID);
    expect(row.seenAt).toBeNull();

    // Mark as seen
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      await tx.$executeRawUnsafe(
        `UPDATE participant_status_improved SET seen_at = now() WHERE id = '${id}'::uuid`,
      );
    });

    const [updated] = await readStatusImproved(prisma, TENANT_A_ID);
    expect(updated.seenAt).not.toBeNull();
  });

  it('unseen filter works: seen events excluded from query', async () => {
    const idA = await seedStatusImproved(prisma, TENANT_A_ID, groupA, userA, 'vermelho', 'amarelo');
    const idB = await seedStatusImproved(prisma, TENANT_A_ID, groupA, userA, 'amarelo', 'verde');

    // Mark idA as seen
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      await tx.$executeRawUnsafe(
        `UPDATE participant_status_improved SET seen_at = now() WHERE id = '${idA}'::uuid`,
      );
    });

    const unseen = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.participantStatusImproved.findMany({ where: { seenAt: null } });
    });

    expect(unseen.some((r) => r.id === idB)).toBe(true);
    expect(unseen.some((r) => r.id === idA)).toBe(false);
  });
});
