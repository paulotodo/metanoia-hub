import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

/** Story 6-2 — participant_radar_status RLS isolation between tenants. */

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
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence)
       VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, '${name}', 'domingo', '10:00', 'weekly')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureUser(prisma: PrismaClient, userId: string, email: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000000'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status)
       VALUES ('${userId}'::uuid, '${email}', 'Test User', 'active')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedRadarStatus(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  participantId: string,
  status: 'verde' | 'amarelo' | 'vermelho',
) {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO participant_radar_status
         (id, tenant_id, group_id, participant_id, status, trend, presence_percentage)
       VALUES
         ('${id}'::uuid, '${tenantId}'::uuid, '${groupId}'::uuid, '${participantId}'::uuid,
          '${status}'::"RadarStatus", 'estavel'::"RadarTrend", 0.75)
       ON CONFLICT (tenant_id, group_id, participant_id) DO UPDATE
         SET status = EXCLUDED.status, calculated_at = now()`,
    );
  });
  return id;
}

async function readRadarStatuses(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.participantRadarStatus.findMany();
  });
}

async function cleanup(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(
        `DELETE FROM participant_radar_status WHERE tenant_id = '${tenantId}'::uuid`,
      );
    });
  }
}

describe('RLS Isolation: participant_radar_status (Story 6-2)', () => {
  let prisma: PrismaClient;

  const groupA = '01912345-6789-7000-8000-000000006a01';
  const groupB = '01912345-6789-7000-8000-000000006b01';
  const userA = '01912345-6789-7000-8000-000000006aa1';
  const userB = '01912345-6789-7000-8000-000000006bb1';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, userA, 'usera@test.com');
    await ensureUser(prisma, userB, 'userb@test.com');
    await ensureGroup(prisma, TENANT_A_ID, groupA, 'Group A');
    await ensureGroup(prisma, TENANT_B_ID, groupB, 'Group B');
  });

  beforeEach(async () => {
    await cleanup(prisma);
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B radar status', async () => {
    await seedRadarStatus(prisma, TENANT_A_ID, groupA, userA, 'verde');
    await seedRadarStatus(prisma, TENANT_B_ID, groupB, userB, 'vermelho');

    const visibleToA = await readRadarStatuses(prisma, TENANT_A_ID);
    expect(visibleToA.some((r) => r.participantId === userA)).toBe(true);
    expect(visibleToA.some((r) => r.participantId === userB)).toBe(false);
  });

  it('tenant B cannot see tenant A radar status', async () => {
    await seedRadarStatus(prisma, TENANT_A_ID, groupA, userA, 'verde');
    await seedRadarStatus(prisma, TENANT_B_ID, groupB, userB, 'vermelho');

    const visibleToB = await readRadarStatuses(prisma, TENANT_B_ID);
    expect(visibleToB.some((r) => r.participantId === userB)).toBe(true);
    expect(visibleToB.some((r) => r.participantId === userA)).toBe(false);
  });

  it('upsert (recalculation) updates existing row without tenant bleed', async () => {
    await seedRadarStatus(prisma, TENANT_A_ID, groupA, userA, 'verde');
    // Re-seed same key with different status
    await seedRadarStatus(prisma, TENANT_A_ID, groupA, userA, 'amarelo');

    const visibleToA = await readRadarStatuses(prisma, TENANT_A_ID);
    const row = visibleToA.find((r) => r.participantId === userA);
    expect(row).toBeDefined();
    expect(row?.status).toBe('amarelo');
    // Still only one row
    expect(visibleToA.filter((r) => r.participantId === userA).length).toBe(1);
  });
});
