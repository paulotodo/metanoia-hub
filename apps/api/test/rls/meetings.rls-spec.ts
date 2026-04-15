import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

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
       VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, 'rls-meetings-group', 'wed', '19:30', 'weekly', NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedMeeting(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  topic: string,
) {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.meeting.create({
      data: {
        id,
        tenantId,
        groupId,
        scheduledFor: new Date('2026-04-20T19:30:00.000Z'),
        topic,
      },
    });
  });
  return { id, tenantId, topic };
}

async function readMeetings(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.meeting.findMany();
  });
}

async function cleanupMeetings(prisma: PrismaClient, topics: string[]) {
  const list = topics.map((t) => `'${t}'`).join(',');
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM meetings WHERE topic IN (${list})`,
      );
    });
  }
}

describe('RLS Isolation: meetings table', () => {
  let prisma: PrismaClient;
  const topicA = 'rls-meetings-tenant-a';
  const topicB = 'rls-meetings-tenant-b';
  const groupAId = '01912345-6789-7000-8000-000000000a10';
  const groupBId = '01912345-6789-7000-8000-000000000b10';

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
    await cleanupMeetings(prisma, [topicA, topicB]);
  });

  afterAll(async () => {
    await cleanupMeetings(prisma, [topicA, topicB]);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B meetings', async () => {
    await seedMeeting(prisma, TENANT_A_ID, groupAId, topicA);
    await seedMeeting(prisma, TENANT_B_ID, groupBId, topicB);

    const visibleToA = await readMeetings(prisma, TENANT_A_ID);
    expect(visibleToA.some((m) => m.topic === topicA)).toBe(true);
    expect(visibleToA.some((m) => m.topic === topicB)).toBe(false);
  });

  it('tenant B cannot see tenant A meetings', async () => {
    await seedMeeting(prisma, TENANT_A_ID, groupAId, topicA);
    await seedMeeting(prisma, TENANT_B_ID, groupBId, topicB);

    const visibleToB = await readMeetings(prisma, TENANT_B_ID);
    expect(visibleToB.some((m) => m.topic === topicB)).toBe(true);
    expect(visibleToB.some((m) => m.topic === topicA)).toBe(false);
  });
});
