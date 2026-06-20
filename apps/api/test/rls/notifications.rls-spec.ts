/**
 * RLS Isolation: notifications table (Story 14-1 / FR77)
 * Idempotente — roda 2x no CI sem erro (ON CONFLICT DO NOTHING).
 *
 * Tests:
 *   1. Tenant A sees only its own notifications (USING policy)
 *   2. Tenant B cannot see Tenant A's notifications
 *   3. INSERT with wrong tenant_id is blocked (WITH CHECK policy)
 *   4. SELECT without SET LOCAL returns 0 rows (GUC vazio = NULLIF = NULL = policy false)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Fixed UUIDs unique to this spec — avoid collision with other specs
const NOTIF_A1_ID = '01977000-0001-7000-8000-000000000001';
const NOTIF_A2_ID = '01977000-0001-7000-8000-000000000002';
const NOTIF_B1_ID = '01977000-0001-7000-8000-000000000003';
const USER_A      = '01977000-0001-7000-8000-000000000a01';
const USER_B      = '01977000-0001-7000-8000-000000000b01';

let privileged: PrismaClient; // superuser / DATABASE_URL — bypasses RLS
let app: PrismaClient;        // app role / DATABASE_APP_URL — RLS enforced

// Helper: insert a notification bypassing RLS (privileged)
async function insertNotification(
  prisma: PrismaClient,
  id: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO notifications (id, tenant_id, user_id, type, channel, status, title, body, metadata, updated_at)
       VALUES (
         $1::uuid, $2::uuid, $3::uuid,
         'group_message'::"notification_type",
         'in_app'::"notification_channel",
         'pending'::"notification_status",
         'Test Title', 'Test Body', '{}', now()
       )
       ON CONFLICT (id) DO NOTHING`,
      id, tenantId, userId,
    );
  });
}

// Helper: ensure tenant exists (idempotent)
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

// Helper: ensure user exists (idempotent, users table has no tenant_id)
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

// Helper: read notifications visible to a given tenant (app role, RLS enforced)
async function readNotifications(prisma: PrismaClient, tenantId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRaw`SELECT id FROM notifications`;
  });
}

// Helper: try INSERT via app role with explicit tenant_id (tests WITH CHECK)
async function tryInsertNotification(
  prisma: PrismaClient,
  tenantCtx: string,
  id: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO notifications (id, tenant_id, user_id, type, channel, status, title, body, metadata, updated_at)
       VALUES (
         $1::uuid, $2::uuid, $3::uuid,
         'system'::"notification_type",
         'in_app'::"notification_channel",
         'pending'::"notification_status",
         'Injected', 'Body', '{}', now()
       )`,
      id, tenantId, userId,
    );
  });
}

beforeAll(async () => {
  // privileged: DATABASE_URL (superuser) — bypasses RLS for setup
  const privAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  privileged = new PrismaClient({ adapter: privAdapter });

  // app: DATABASE_APP_URL (NOSUPERUSER, RLS enforced)
  const appAdapter = new PrismaPg({ connectionString: process.env.DATABASE_APP_URL! });
  app = new PrismaClient({ adapter: appAdapter });

  // Setup tenants and users
  await ensureTenant(privileged, TENANT_A_ID, 'Tenant Alpha');
  await ensureTenant(privileged, TENANT_B_ID, 'Tenant Beta');
  await ensureUser(privileged, USER_A, 'user-a-notif-rls@test.com');
  await ensureUser(privileged, USER_B, 'user-b-notif-rls@test.com');

  // Seed notifications for each tenant
  await insertNotification(privileged, NOTIF_A1_ID, TENANT_A_ID, USER_A);
  await insertNotification(privileged, NOTIF_A2_ID, TENANT_A_ID, USER_A);
  await insertNotification(privileged, NOTIF_B1_ID, TENANT_B_ID, USER_B);
});

afterAll(async () => {
  // Cleanup — idempotent: ON CONFLICT DO NOTHING means rows may or may not exist
  await privileged.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM notifications WHERE id IN ($1::uuid, $2::uuid, $3::uuid)`,
      NOTIF_A1_ID, NOTIF_A2_ID, NOTIF_B1_ID,
    );
  }).catch(() => {
    // Best-effort cleanup
  });
  await privileged.$disconnect();
  await app.$disconnect();
});

describe('notifications RLS isolation', () => {
  it('Tenant A sees only its own notifications (USING policy)', async () => {
    const rows = await readNotifications(app, TENANT_A_ID) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(NOTIF_A1_ID);
    expect(ids).toContain(NOTIF_A2_ID);
    expect(ids).not.toContain(NOTIF_B1_ID);
  });

  it('Tenant B sees only its own notifications (USING policy)', async () => {
    const rows = await readNotifications(app, TENANT_B_ID) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(NOTIF_B1_ID);
    expect(ids).not.toContain(NOTIF_A1_ID);
    expect(ids).not.toContain(NOTIF_A2_ID);
  });

  it('SELECT without SET LOCAL returns 0 rows (GUC vazio = NULLIF null = policy false)', async () => {
    // No SET LOCAL — current_setting returns '' → NULLIF → NULL → UUID cast fails → 0 rows
    const rows = await app.$transaction(async (tx) => {
      return tx.$queryRaw`SELECT id FROM notifications`;
    }) as unknown[];
    expect(rows.length).toBe(0);
  });

  it('INSERT with wrong tenant_id is blocked by WITH CHECK policy', async () => {
    const BAD_ID = '01977000-0001-7000-8000-000000000099';
    // tenantCtx = TENANT_A but tenant_id in INSERT = TENANT_B → WITH CHECK violation
    await expect(
      tryInsertNotification(app, TENANT_A_ID, BAD_ID, TENANT_B_ID, USER_A),
    ).rejects.toThrow();
  });

  it('is idempotent — re-running setup does not error (ON CONFLICT DO NOTHING)', async () => {
    // Re-insert same rows — must succeed silently
    await expect(
      insertNotification(privileged, NOTIF_A1_ID, TENANT_A_ID, USER_A),
    ).resolves.not.toThrow();
    await expect(
      insertNotification(privileged, NOTIF_B1_ID, TENANT_B_ID, USER_B),
    ).resolves.not.toThrow();
  });
});
