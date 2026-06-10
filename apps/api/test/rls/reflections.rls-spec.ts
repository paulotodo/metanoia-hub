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

async function ensureMeeting(
  prisma: PrismaClient,
  tenantId: string,
  meetingId: string,
) {
  const groupId = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
       VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, 'rls-reflections-group', 'wed', '19:30', 'weekly', NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO meetings (id, tenant_id, group_id, scheduled_for, status, updated_at)
       VALUES ('${meetingId}'::uuid, '${tenantId}'::uuid, '${groupId}'::uuid,
               '2026-04-20T19:30:00Z'::timestamptz, 'scheduled', NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedReflection(
  prisma: PrismaClient,
  tenantId: string,
  meetingId: string,
  text: string,
) {
  const id = generateId();
  const leaderId = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.reflection.create({
      data: { id, tenantId, meetingId, leaderId, text },
    });
  });
  return { id, tenantId, text };
}

async function readReflections(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.reflection.findMany();
  });
}

async function cleanupReflections(prisma: PrismaClient, texts: string[]) {
  const list = texts.map((t) => `'${t}'`).join(',');
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM reflections WHERE text IN (${list})`,
      );
    });
  }
}

describe('RLS Isolation: reflections table', () => {
  let prisma: PrismaClient;
  const textA = 'rls-reflection-tenant-a';
  const textB = 'rls-reflection-tenant-b';
  const meetingAId = '01912345-6789-7000-8000-000000000ca1';
  const meetingBId = '01912345-6789-7000-8000-000000000cb1';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureMeeting(prisma, TENANT_A_ID, meetingAId);
    await ensureMeeting(prisma, TENANT_B_ID, meetingBId);
  });

  beforeEach(async () => {
    await cleanupReflections(prisma, [textA, textB]);
    // Re-ensure the FK parents (meetings) before each test. Other RLS specs
    // running in the same suite can wipe the meetings table between this
    // suite's beforeAll and its tests, causing an intermittent
    // `reflections_meeting_id_fkey` violation. ensureMeeting is idempotent
    // (ON CONFLICT DO NOTHING), so this is a cheap, self-healing guard.
    await ensureMeeting(prisma, TENANT_A_ID, meetingAId);
    await ensureMeeting(prisma, TENANT_B_ID, meetingBId);
  });

  afterAll(async () => {
    await cleanupReflections(prisma, [textA, textB]);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B reflections', async () => {
    await seedReflection(prisma, TENANT_A_ID, meetingAId, textA);
    await seedReflection(prisma, TENANT_B_ID, meetingBId, textB);

    const visibleToA = await readReflections(prisma, TENANT_A_ID);
    expect(visibleToA.some((r) => r.text === textA)).toBe(true);
    expect(visibleToA.some((r) => r.text === textB)).toBe(false);
  });

  it('tenant B cannot see tenant A reflections', async () => {
    await seedReflection(prisma, TENANT_A_ID, meetingAId, textA);
    await seedReflection(prisma, TENANT_B_ID, meetingBId, textB);

    const visibleToB = await readReflections(prisma, TENANT_B_ID);
    expect(visibleToB.some((r) => r.text === textB)).toBe(true);
    expect(visibleToB.some((r) => r.text === textA)).toBe(false);
  });
});
