import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

/**
 * Story 5.3 AC5 — meeting_attendance must be tenant-isolated, including
 * when reads JOIN across meeting↔group relationships cross-tenant.
 */

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

async function ensureGroup(prisma: PrismaClient, tenantId: string, groupId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
       VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, 'rls-attendance-group', 'wed', '19:30', 'weekly', NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureMeeting(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  meetingId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.meeting.create({
      data: {
        id: meetingId,
        tenantId,
        groupId,
        scheduledFor: new Date('2026-04-20T19:30:00.000Z'),
      },
    });
  });
}

async function seedAttendance(
  prisma: PrismaClient,
  tenantId: string,
  meetingId: string,
  userId: string,
  presenceType: string,
) {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.meetingAttendance.create({
      data: {
        id,
        tenantId,
        meetingId,
        userId,
        joinTime: new Date('2026-04-20T19:30:00.000Z'),
        leaveTime: new Date('2026-04-20T20:30:00.000Z'),
        totalDurationSeconds: 3600,
        presenceType,
        reconnections: 0,
      },
    });
  });
  return id;
}

async function readAttendance(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.meetingAttendance.findMany();
  });
}

/** Cross-tenant JOIN attempt: meeting_attendance → meetings → groups. */
async function readAttendanceWithGroupJoin(
  prisma: PrismaClient,
  tenantCtx: string,
): Promise<Array<{ id: string; presence_type: string }>> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return (await tx.$queryRawUnsafe(
      `SELECT a.id, a.presence_type
       FROM meeting_attendance a
       JOIN meetings m ON m.id = a.meeting_id
       JOIN groups g ON g.id = m.group_id`,
    )) as Array<{ id: string; presence_type: string }>;
  });
}

async function cleanupAttendance(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM meeting_attendance WHERE presence_type = 'integral' OR presence_type = 'parcial'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM meetings WHERE topic IS NULL AND scheduled_for = '2026-04-20T19:30:00.000Z'`,
      );
    });
  }
}

describe('RLS Isolation: meeting_attendance (Story 5.3 AC5)', () => {
  let prisma: PrismaClient;
  const groupAId = '01912345-6789-7000-8000-000000005a10';
  const groupBId = '01912345-6789-7000-8000-000000005b10';
  const meetingAId = '01912345-6789-7000-8000-000000005a20';
  const meetingBId = '01912345-6789-7000-8000-000000005b20';
  const userAId = '01912345-6789-7000-8000-000000005aa1';
  const userBId = '01912345-6789-7000-8000-000000005bb1';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureGroup(prisma, TENANT_A_ID, groupAId);
    await ensureGroup(prisma, TENANT_B_ID, groupBId);
  });

  beforeEach(async () => {
    await cleanupAttendance(prisma);
    await ensureMeeting(prisma, TENANT_A_ID, groupAId, meetingAId);
    await ensureMeeting(prisma, TENANT_B_ID, groupBId, meetingBId);
  });

  afterAll(async () => {
    await cleanupAttendance(prisma);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B attendance', async () => {
    await seedAttendance(prisma, TENANT_A_ID, meetingAId, userAId, 'integral');
    await seedAttendance(prisma, TENANT_B_ID, meetingBId, userBId, 'parcial');

    const visibleToA = await readAttendance(prisma, TENANT_A_ID);
    expect(visibleToA.some((a) => a.userId === userAId)).toBe(true);
    expect(visibleToA.some((a) => a.userId === userBId)).toBe(false);
  });

  it('JOIN attendance ↔ meeting ↔ group does not leak cross-tenant rows', async () => {
    await seedAttendance(prisma, TENANT_A_ID, meetingAId, userAId, 'integral');
    await seedAttendance(prisma, TENANT_B_ID, meetingBId, userBId, 'parcial');

    const a = await readAttendanceWithGroupJoin(prisma, TENANT_A_ID);
    const b = await readAttendanceWithGroupJoin(prisma, TENANT_B_ID);
    expect(a).toHaveLength(1);
    expect(a[0]!.presence_type).toBe('integral');
    expect(b).toHaveLength(1);
    expect(b[0]!.presence_type).toBe('parcial');
  });
});
