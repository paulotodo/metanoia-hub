import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';

/**
 * Story 7-2 — RLS isolation for demo tenant data.
 *
 * Verifies that rows seeded for a tenant flagged `is_demo=true` are invisible
 * under any other tenant's RLS context. Mirrors the canonical groups RLS spec
 * but pivots on the `is_demo` flag and on tables the demo seed touches
 * (groups + pastoral_alerts).
 */

const DEMO_TENANT_ID = '019899a0-7002-7000-9000-000000000001';
const REGULAR_TENANT_ID = '019899a0-7002-7000-9000-000000000002';
const DEMO_GROUP_NAME = 'rls-demo-group';
const REGULAR_GROUP_NAME = 'rls-regular-group';

async function ensureTenant(
  prisma: PrismaClient,
  tenantId: string,
  name: string,
  isDemo: boolean,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name, is_demo)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}', ${isDemo})
       ON CONFLICT (id) DO UPDATE SET is_demo = EXCLUDED.is_demo`,
    );
  });
}

async function seedGroup(prisma: PrismaClient, tenantId: string, name: string) {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.group.create({
      data: {
        id,
        tenantId,
        name,
        dayOfWeek: 'thu',
        time: '19:30',
        recurrence: 'weekly',
        notes: null,
      },
    });
  });
  return id;
}

async function readGroups(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.group.findMany();
  });
}

async function readDemoTenants(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.tenant.findMany({ where: { isDemo: true } });
  });
}

async function seedPastoralAlertOnGroup(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  marker: string,
) {
  const userId = generateId();
  const alertId = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.user.create({
      data: {
        id: userId,
        email: `${userId}@rls.test`,
        name: `RLS user ${marker}`,
        tenantId,
      },
    });
    await tx.pastoralAlert.create({
      data: {
        id: alertId,
        tenantId,
        participantId: userId,
        groupId,
        signalType: 'care-urgent',
        signalVariant: 'sustained-absence',
        contextPhrase: marker,
        observedFact: marker,
        systemLimitation: marker,
        active: true,
      },
    });
  });
  return { alertId, userId };
}

async function readPastoralAlerts(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.pastoralAlert.findMany();
  });
}

async function cleanup(prisma: PrismaClient) {
  for (const tenantId of [DEMO_TENANT_ID, REGULAR_TENANT_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM pastoral_alerts WHERE tenant_id = '${tenantId}'::uuid`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM users WHERE tenant_id = '${tenantId}'::uuid AND email LIKE '%@rls.test'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM groups WHERE name IN ('${DEMO_GROUP_NAME}', '${REGULAR_GROUP_NAME}')`,
      );
    });
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${DEMO_TENANT_ID}'`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM tenants WHERE id IN ('${DEMO_TENANT_ID}'::uuid, '${REGULAR_TENANT_ID}'::uuid)`,
    );
  });
}

describe('RLS Isolation: demo tenant data (Story 7-2)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    await ensureTenant(prisma, DEMO_TENANT_ID, 'Igreja Demo (RLS)', true);
    await ensureTenant(prisma, REGULAR_TENANT_ID, 'Igreja Regular (RLS)', false);
  });

  beforeEach(async () => {
    for (const tenantId of [DEMO_TENANT_ID, REGULAR_TENANT_ID]) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${tenantId}'`,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM pastoral_alerts WHERE tenant_id = '${tenantId}'::uuid`,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM users WHERE tenant_id = '${tenantId}'::uuid AND email LIKE '%@rls.test'`,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM groups WHERE name IN ('${DEMO_GROUP_NAME}', '${REGULAR_GROUP_NAME}')`,
        );
      });
    }
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  it('persists is_demo=true on the demo tenant row', async () => {
    const visible = await readDemoTenants(prisma, DEMO_TENANT_ID);
    expect(visible.some((t) => t.id === DEMO_TENANT_ID && t.isDemo === true)).toBe(true);
  });

  it('regular tenant cannot see demo tenant groups', async () => {
    await seedGroup(prisma, DEMO_TENANT_ID, DEMO_GROUP_NAME);
    await seedGroup(prisma, REGULAR_TENANT_ID, REGULAR_GROUP_NAME);

    const visibleToRegular = await readGroups(prisma, REGULAR_TENANT_ID);
    expect(visibleToRegular.some((g) => g.name === REGULAR_GROUP_NAME)).toBe(true);
    expect(visibleToRegular.some((g) => g.name === DEMO_GROUP_NAME)).toBe(false);
  });

  it('demo tenant cannot see regular tenant groups', async () => {
    await seedGroup(prisma, DEMO_TENANT_ID, DEMO_GROUP_NAME);
    await seedGroup(prisma, REGULAR_TENANT_ID, REGULAR_GROUP_NAME);

    const visibleToDemo = await readGroups(prisma, DEMO_TENANT_ID);
    expect(visibleToDemo.some((g) => g.name === DEMO_GROUP_NAME)).toBe(true);
    expect(visibleToDemo.some((g) => g.name === REGULAR_GROUP_NAME)).toBe(false);
  });

  it('regular tenant context cannot see the demo tenant row itself', async () => {
    const visibleToRegular = await readDemoTenants(prisma, REGULAR_TENANT_ID);
    expect(visibleToRegular.some((t) => t.id === DEMO_TENANT_ID)).toBe(false);
  });

  it('regular tenant cannot see pastoral_alerts seeded for the demo tenant', async () => {
    const demoGroupId = await seedGroup(prisma, DEMO_TENANT_ID, DEMO_GROUP_NAME);
    const regularGroupId = await seedGroup(
      prisma,
      REGULAR_TENANT_ID,
      REGULAR_GROUP_NAME,
    );

    await seedPastoralAlertOnGroup(prisma, DEMO_TENANT_ID, demoGroupId, 'demo-alert');
    await seedPastoralAlertOnGroup(
      prisma,
      REGULAR_TENANT_ID,
      regularGroupId,
      'regular-alert',
    );

    const visibleToRegular = await readPastoralAlerts(prisma, REGULAR_TENANT_ID);
    expect(visibleToRegular.some((a) => a.contextPhrase === 'regular-alert')).toBe(true);
    expect(visibleToRegular.some((a) => a.contextPhrase === 'demo-alert')).toBe(false);

    const visibleToDemo = await readPastoralAlerts(prisma, DEMO_TENANT_ID);
    expect(visibleToDemo.some((a) => a.contextPhrase === 'demo-alert')).toBe(true);
    expect(visibleToDemo.some((a) => a.contextPhrase === 'regular-alert')).toBe(false);
  });
});
