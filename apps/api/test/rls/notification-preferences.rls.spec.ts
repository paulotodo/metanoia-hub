/**
 * RLS Isolation: notification_preferences table (Story 16-1 / FR78)
 * Idempotente — roda 2x no CI sem erro (ON CONFLICT DO NOTHING).
 *
 * Tests:
 *   1. Tenant A sees only its own preferences (USING policy)
 *   2. Tenant B cannot see Tenant A's preferences
 *   3. INSERT with wrong tenant_id is blocked (WITH CHECK policy)
 *   4. SELECT without SET LOCAL returns 0 rows (GUC vazio = NULLIF = NULL = policy false)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Fixed UUIDs unique to this spec — avoid collision with other specs
const PREF_A1_ID = '01977600-0001-7600-8000-000000000001';
const PREF_B1_ID = '01977600-0001-7600-8000-000000000002';
const USER_A     = '01977600-0001-7600-8000-000000000a01';
const USER_B     = '01977600-0001-7600-8000-000000000b01';

let privileged: PrismaClient;
let app: PrismaClient;

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name)
       VALUES ($1::uuid, $1::uuid, $2)
       ON CONFLICT (id) DO NOTHING`,
      tenantId, name,
    );
  });
}

async function ensureUser(prisma: PrismaClient, userId: string, email: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, updated_at)
       VALUES ($1::uuid, $2, 'Test', 'active', now())
       ON CONFLICT (id) DO NOTHING`,
      userId, email,
    );
  });
}

async function insertPref(
  prisma: PrismaClient,
  id: string,
  tenantId: string,
  userId: string,
  notifType: string = 'pastoral_alert',
  channel: string = 'in_app',
  enabled: boolean = true,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO notification_preferences (id, tenant_id, user_id, notification_type, channel, enabled, updated_at)
       VALUES (
         $1::uuid, $2::uuid, $3::uuid,
         $4::"notification_type",
         $5::"notification_channel",
         $6,
         now()
       )
       ON CONFLICT (user_id, tenant_id, notification_type, channel) DO NOTHING`,
      id, tenantId, userId, notifType, channel, enabled,
    );
  });
}

async function readPrefs(prisma: PrismaClient, tenantId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRaw`SELECT id FROM notification_preferences`;
  });
}

beforeAll(async () => {
  const appUrl = process.env.DATABASE_APP_URL;
  const privilegedUrl = process.env.DATABASE_URL;
  if (!appUrl || !privilegedUrl) {
    throw new Error(
      'DATABASE_APP_URL and DATABASE_URL required — run docker-compose up first',
    );
  }
  app = new PrismaClient({ adapter: new PrismaPg({ connectionString: appUrl }) });
  privileged = new PrismaClient({ adapter: new PrismaPg({ connectionString: privilegedUrl }) });

  await ensureTenant(privileged, TENANT_A_ID, 'RLS Test Tenant A');
  await ensureTenant(privileged, TENANT_B_ID, 'RLS Test Tenant B');
  await ensureUser(privileged, USER_A, 'rls-pref-a@test.local');
  await ensureUser(privileged, USER_B, 'rls-pref-b@test.local');

  // Seed: tenant A preference
  await insertPref(privileged, PREF_A1_ID, TENANT_A_ID, USER_A, 'pastoral_alert', 'in_app', true);
  // Seed: tenant B preference
  await insertPref(privileged, PREF_B1_ID, TENANT_B_ID, USER_B, 'pastoral_alert', 'in_app', true);
});

afterAll(async () => {
  await app.$disconnect();
  await privileged.$disconnect();
});

describe('notification_preferences RLS isolation', () => {
  it('tenant A sees only its own preferences', async () => {
    const rows = await readPrefs(app, TENANT_A_ID) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(PREF_A1_ID);
    expect(ids).not.toContain(PREF_B1_ID);
  });

  it('tenant B cannot see tenant A preferences', async () => {
    const rows = await readPrefs(app, TENANT_B_ID) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(PREF_A1_ID);
    expect(ids).toContain(PREF_B1_ID);
  });

  it('INSERT with wrong tenant_id is blocked by WITH CHECK', async () => {
    await expect(
      app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        // Try to insert a preference for tenant B while context is tenant A
        await tx.$executeRawUnsafe(
          `INSERT INTO notification_preferences (id, tenant_id, user_id, notification_type, channel, enabled, updated_at)
           VALUES (
             gen_random_uuid(), $1::uuid, $2::uuid,
             'meeting_reminder'::"notification_type",
             'email'::"notification_channel",
             false,
             now()
           )`,
          TENANT_B_ID, USER_B,
        );
      }),
    ).rejects.toThrow();
  });

  it('SELECT without SET LOCAL returns 0 rows (empty GUC = NULLIF = NULL)', async () => {
    const rows = await app.$transaction(async (tx) => {
      // Explicitly clear the GUC
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.$queryRaw`SELECT id FROM notification_preferences`;
    });
    expect((rows as unknown[]).length).toBe(0);
  });
});
