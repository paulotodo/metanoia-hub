import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

/** Story 5.4 — meeting_telemetry RLS isolation between tenants. */

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

async function seedTelemetry(
  prisma: PrismaClient,
  tenantId: string,
  meetingId: string,
  userId: string,
  cameraOn: number,
) {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.meetingTelemetry.create({
      data: {
        id,
        tenantId,
        meetingId,
        userId,
        cameraOnSeconds: cameraOn,
        roomDurationSeconds: 3600,
        focusScore: null,
      },
    });
  });
  return id;
}

async function readTelemetry(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.meetingTelemetry.findMany();
  });
}

async function cleanup(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM meeting_telemetry WHERE room_duration_seconds = 3600`,
      );
    });
  }
}

describe('RLS Isolation: meeting_telemetry (Story 5.4)', () => {
  let prisma: PrismaClient;
  const meetingA = '01912345-6789-7000-8000-000000005a40';
  const meetingB = '01912345-6789-7000-8000-000000005b40';
  const userA = '01912345-6789-7000-8000-000000005aa4';
  const userB = '01912345-6789-7000-8000-000000005bb4';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
  });

  beforeEach(async () => {
    await cleanup(prisma);
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B telemetry', async () => {
    await seedTelemetry(prisma, TENANT_A_ID, meetingA, userA, 100);
    await seedTelemetry(prisma, TENANT_B_ID, meetingB, userB, 200);

    const visibleToA = await readTelemetry(prisma, TENANT_A_ID);
    expect(visibleToA.some((t) => t.userId === userA)).toBe(true);
    expect(visibleToA.some((t) => t.userId === userB)).toBe(false);
  });

  it('tenant B cannot see tenant A telemetry', async () => {
    await seedTelemetry(prisma, TENANT_A_ID, meetingA, userA, 100);
    await seedTelemetry(prisma, TENANT_B_ID, meetingB, userB, 200);

    const visibleToB = await readTelemetry(prisma, TENANT_B_ID);
    expect(visibleToB.some((t) => t.userId === userB)).toBe(true);
    expect(visibleToB.some((t) => t.userId === userA)).toBe(false);
  });
});
