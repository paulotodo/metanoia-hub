/**
 * RLS isolation tests for pastoral_alerts (Story 6-3).
 * Verifies: tenant_a cannot see tenant_b's alerts and vice versa.
 *
 * NOTE: These tests require a running PostgreSQL instance with RLS enabled.
 * They run in CI via docker-compose.test.yml.
 *
 * Pattern matches other RLS specs in this directory.
 * Armadilha: updated_at is NOT NULL but has no DB default → include in INSERT.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

const GROUP_A_ID = generateId();
const GROUP_B_ID = generateId();
const USER_A_ID = generateId();
const USER_B_ID = generateId();

async function setupFixtures(prisma: PrismaClient): Promise<void> {
  // Ensure tenants
  for (const [tenantId, name] of [
    [TENANT_A_ID, 'rls-pa-tenant-a'],
    [TENANT_B_ID, 'rls-pa-tenant-b'],
  ] as const) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(`
        INSERT INTO tenants (id, tenant_id, name)
        VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}')
        ON CONFLICT (id) DO NOTHING
      `);
    });
  }

  // Ensure users — inserted as GLOBAL (no tenant_id) under the zero-tenant
  // context, mirroring radar-status.rls-spec. Users are linked to tenants via
  // UserTenant, not a tenant_id column; pastoral_alerts.participant_id only
  // needs the user row to exist. Inserting tenant-scoped under RLS makes the
  // existing row invisible to ON CONFLICT and breaks idempotency.
  for (const [userId, email] of [
    [USER_A_ID, 'rls-pa-a@test.com'],
    [USER_B_ID, 'rls-pa-b@test.com'],
  ] as const) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000000'`,
      );
      await tx.$executeRawUnsafe(`
        INSERT INTO users (id, email, name, status, updated_at)
        VALUES ('${userId}'::uuid, '${email}', 'RLS PA User', 'active', NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    });
  }

  // Ensure groups
  for (const [groupId, tenantId, gname] of [
    [GROUP_A_ID, TENANT_A_ID, 'rls-pa-group-a'],
    [GROUP_B_ID, TENANT_B_ID, 'rls-pa-group-b'],
  ] as const) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(`
        INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
        VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, '${gname}', 'mon', '19:00', 'weekly', NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    });
  }
}

async function seedAlert(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  participantId: string,
) {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO pastoral_alerts
        (id, tenant_id, group_id, participant_id, signal_type, presence_dots,
         previous_status, new_status, trend, updated_at)
      VALUES
        ('${id}'::uuid, '${tenantId}'::uuid, '${groupId}'::uuid,
         '${participantId}'::uuid, 'care-urgent', '[]',
         'verde'::"RadarStatus", 'amarelo'::"RadarStatus", 'declinio'::"RadarTrend",
         NOW())
    `);
  });
  return id;
}

async function readAlerts(prisma: PrismaClient, tenantCtx: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    const rows = await tx.pastoralAlert.findMany({
      where: {
        previousStatus: { not: null },
      },
      select: { id: true, tenantId: true },
    });
    return rows.map((r) => r.id);
  });
}

describe('pastoral_alerts RLS isolation', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await setupFixtures(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('tenant_a sees only tenant_a alerts', async () => {
    const alertA = await seedAlert(prisma, TENANT_A_ID, GROUP_A_ID, USER_A_ID);
    const alertB = await seedAlert(prisma, TENANT_B_ID, GROUP_B_ID, USER_B_ID);

    const visibleToA = await readAlerts(prisma, TENANT_A_ID);

    expect(visibleToA).toContain(alertA);
    expect(visibleToA).not.toContain(alertB);
  });

  it('tenant_b sees only tenant_b alerts', async () => {
    const alertA = await seedAlert(prisma, TENANT_A_ID, GROUP_A_ID, USER_A_ID);
    const alertB = await seedAlert(prisma, TENANT_B_ID, GROUP_B_ID, USER_B_ID);

    const visibleToB = await readAlerts(prisma, TENANT_B_ID);

    expect(visibleToB).toContain(alertB);
    expect(visibleToB).not.toContain(alertA);
  });

  it('no tenant context → sees nothing (RLS blocks all)', async () => {
    await seedAlert(prisma, TENANT_A_ID, GROUP_A_ID, USER_A_ID);

    const visible = await readAlerts(prisma, '');

    // With empty tenant context, NULLIF returns NULL → RLS blocks all rows
    expect(visible).toHaveLength(0);
  });
});
