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

// Story 14-2b — mark-all RLS: cross-tenant isolation (idempotent, CI runs 2x)
// Uses separate UUIDs to avoid collision with Story 14-1 tests above.

// Helper: markAllAsRead via app role (RLS enforced)
async function markAllAsReadForTenant(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
): Promise<number> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE notifications
       SET status = 'read'::"notification_status", read_at = now(), updated_at = now()
       WHERE user_id = $1::uuid AND status <> 'read'::"notification_status"
       RETURNING id`,
      userId,
    );
  });
  return (result as Array<{ id: string }>).length;
}

// Helper: get status of a specific notification (privileged, bypasses RLS)
async function getNotificationStatus(
  prisma: PrismaClient,
  id: string,
): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
    `SELECT status::text FROM notifications WHERE id = $1::uuid`,
    id,
  );
  const arr = rows as Array<{ status: string }>;
  return arr.length > 0 && arr[0] ? arr[0].status : null;
}

describe('notifications RLS — mark-all cross-tenant isolation (Story 14-2b)', () => {
  // New IDs that don't collide with 14-1 tests
  const MA_A1_ID = '01977000-0001-7000-8000-000000000011';
  const MA_A2_ID = '01977000-0001-7000-8000-000000000012';
  const MA_B1_ID = '01977000-0001-7000-8000-000000000013';
  const MA_B2_ID = '01977000-0001-7000-8000-000000000014';
  const USER_MA_A = '01977000-0001-7000-8000-000000000a11';
  const USER_MA_B = '01977000-0001-7000-8000-000000000b11';

  beforeAll(async () => {
    // Ensure users exist (idempotent)
    await ensureUser(privileged, USER_MA_A, 'user-ma-a@rls-test.com');
    await ensureUser(privileged, USER_MA_B, 'user-ma-b@rls-test.com');
    // Insert 2 pending notifications for each tenant
    await insertNotification(privileged, MA_A1_ID, TENANT_A_ID, USER_MA_A);
    await insertNotification(privileged, MA_A2_ID, TENANT_A_ID, USER_MA_A);
    await insertNotification(privileged, MA_B1_ID, TENANT_B_ID, USER_MA_B);
    await insertNotification(privileged, MA_B2_ID, TENANT_B_ID, USER_MA_B);
  });

  afterEach(async () => {
    // Reset to pending so idempotency test works on 2nd CI run
    await privileged.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE notifications SET status = 'pending'::"notification_status", read_at = NULL
         WHERE id IN ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
        MA_A1_ID, MA_A2_ID, MA_B1_ID, MA_B2_ID,
      );
    }).catch(() => {/* best-effort */});
  });

  afterAll(async () => {
    await privileged.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM notifications WHERE id IN ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
        MA_A1_ID, MA_A2_ID, MA_B1_ID, MA_B2_ID,
      );
    }).catch(() => {/* best-effort */});
  });

  it('mark-all for Tenant A only marks A notifications, B remains pending', async () => {
    const count = await markAllAsReadForTenant(app, TENANT_A_ID, USER_MA_A);
    expect(count).toBe(2);

    // A's notifications should now be read
    expect(await getNotificationStatus(privileged, MA_A1_ID)).toBe('read');
    expect(await getNotificationStatus(privileged, MA_A2_ID)).toBe('read');

    // B's notifications must remain pending (cross-tenant isolation)
    expect(await getNotificationStatus(privileged, MA_B1_ID)).toBe('pending');
    expect(await getNotificationStatus(privileged, MA_B2_ID)).toBe('pending');
  });

  it('mark-all is idempotent: calling twice returns 0 on second call', async () => {
    // First call: mark 2 as read
    const first = await markAllAsReadForTenant(app, TENANT_A_ID, USER_MA_A);
    expect(first).toBe(2);
    // Second call: nothing left unread → count = 0
    const second = await markAllAsReadForTenant(app, TENANT_A_ID, USER_MA_A);
    expect(second).toBe(0);
  });
});

// Story 14-2c — RLS: filtro since preserva isolamento de tenant
// Idempotente — roda 2x no CI por padrão (ON CONFLICT DO NOTHING).

// Helper: findByUser with since filter via app role (RLS enforced)
async function findByUserWithSince(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
  since: string,
): Promise<string[]> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM notifications
       WHERE user_id = $1::uuid AND created_at > $2::timestamptz
       ORDER BY created_at DESC`,
      userId,
      since,
    );
  });
  return (result as Array<{ id: string }>).map((r) => r.id);
}

describe('RLS: filtro since preserva isolamento de tenant (Story 14-2c)', () => {
  // Rodado 2× no CI por padrão (idempotência RLS)
  const SINCE_A1_ID = '01977000-0002-7000-8000-000000000021';
  const SINCE_B1_ID = '01977000-0002-7000-8000-000000000022';
  const USER_SINCE_A = '01977000-0002-7000-8000-000000000a21';
  const USER_SINCE_B = '01977000-0002-7000-8000-000000000b21';

  // A timestamp older than the notifications we insert
  const sinceTimestamp = '2020-01-01T00:00:00.000Z';

  beforeAll(async () => {
    await ensureUser(privileged, USER_SINCE_A, 'user-since-a@rls-test.com');
    await ensureUser(privileged, USER_SINCE_B, 'user-since-b@rls-test.com');
    // Insert one notification per tenant (created_at = now(), which is > sinceTimestamp)
    await insertNotification(privileged, SINCE_A1_ID, TENANT_A_ID, USER_SINCE_A);
    await insertNotification(privileged, SINCE_B1_ID, TENANT_B_ID, USER_SINCE_B);
  });

  afterAll(async () => {
    await privileged.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM notifications WHERE id IN ($1::uuid, $2::uuid)`,
        SINCE_A1_ID, SINCE_B1_ID,
      );
    }).catch(() => {/* best-effort */});
  });

  it('findByUser with since: Tenant A sees only its own notification', async () => {
    const ids = await findByUserWithSince(app, TENANT_A_ID, USER_SINCE_A, sinceTimestamp);
    expect(ids).toContain(SINCE_A1_ID);
    expect(ids).not.toContain(SINCE_B1_ID);
  });

  it('findByUser with since: Tenant B does not see Tenant A notification (roles invertidas)', async () => {
    const ids = await findByUserWithSince(app, TENANT_B_ID, USER_SINCE_B, sinceTimestamp);
    expect(ids).toContain(SINCE_B1_ID);
    expect(ids).not.toContain(SINCE_A1_ID);
  });

  it('since futuro → retorna lista vazia (sem leak cross-tenant)', async () => {
    const futureTs = new Date(Date.now() + 86400000).toISOString();
    const ids = await findByUserWithSince(app, TENANT_A_ID, USER_SINCE_A, futureTs);
    expect(ids).toHaveLength(0);
  });

  it('is idempotent — re-running setup does not error (ON CONFLICT DO NOTHING)', async () => {
    await expect(
      insertNotification(privileged, SINCE_A1_ID, TENANT_A_ID, USER_SINCE_A),
    ).resolves.not.toThrow();
    await expect(
      insertNotification(privileged, SINCE_B1_ID, TENANT_B_ID, USER_SINCE_B),
    ).resolves.not.toThrow();
  });
});
