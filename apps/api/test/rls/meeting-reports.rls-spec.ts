import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

/** Story 5.6 — meeting_reports RLS isolation between tenants. */

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

async function seedReport(
  prisma: PrismaClient,
  tenantId: string,
  meetingId: string,
  marker: string,
) {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.meetingReport.create({
      data: {
        id,
        tenantId,
        meetingId,
        summary: { marker },
      },
    });
  });
  return id;
}

async function readReports(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.meetingReport.findMany();
  });
}

async function cleanup(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM meeting_reports WHERE summary ? 'marker'`,
      );
    });
  }
}

describe('RLS Isolation: meeting_reports (Story 5.6)', () => {
  let prisma: PrismaClient;
  const meetingA = '01912345-6789-7000-8000-000000005a60';
  const meetingB = '01912345-6789-7000-8000-000000005b60';

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

  it('tenant A cannot see tenant B reports', async () => {
    await seedReport(prisma, TENANT_A_ID, meetingA, 'rls-report-a');
    await seedReport(prisma, TENANT_B_ID, meetingB, 'rls-report-b');

    const visibleToA = await readReports(prisma, TENANT_A_ID);
    expect(visibleToA.some((r) => r.meetingId === meetingA)).toBe(true);
    expect(visibleToA.some((r) => r.meetingId === meetingB)).toBe(false);
  });
});
