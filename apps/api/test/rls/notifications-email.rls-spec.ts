/**
 * RLS Isolation: Story 14-3 Email Notifications (FR77 / NFR-I1/I2/I3)
 *
 * Verifica:
 *   1. Tenant A NÃO vê notificações do Tenant B (USING policy)
 *   2. WITH CHECK: INSERT com tenant_id errado bloqueado pelo app role
 *   3. SELECT sem SET LOCAL retorna 0 linhas (GUC vazio = policy false)
 *   4. Contadores Redis de rate-limit são namespaced por tenant
 *   5. Novos tipos export_ready e content_new aceitos pela policy
 *
 * Idempotente — pode rodar 2x no CI sem erro (ON CONFLICT DO NOTHING).
 * Cleanup explícito em afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ─── Fixed UUIDs unique to this spec (avoid collision) ──────────────────────
const EMAIL_A1_ID = '01977000-ee01-7000-8000-000000000001';
const EMAIL_A2_ID = '01977000-ee01-7000-8000-000000000002';
const EMAIL_B1_ID = '01977000-ee01-7000-8000-000000000003';
const EMAIL_B2_ID = '01977000-ee01-7000-8000-000000000004';
const USER_EA     = '01977000-ee01-7000-8000-000000000a01';
const USER_EB     = '01977000-ee01-7000-8000-000000000b01';

let privileged: PrismaClient;
let app: PrismaClient;
let redis: Redis;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenants (id, tenant_id, name) VALUES ($1::uuid, $1::uuid, $2) ON CONFLICT (id) DO NOTHING`,
    tenantId, name,
  );
}

async function ensureUser(prisma: PrismaClient, userId: string, email: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, updated_at)
     VALUES ($1::uuid, $2, 'RLS-Test', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
    userId, email,
  );
}

async function insertEmailNotification(
  prisma: PrismaClient,
  id: string,
  tenantId: string,
  userId: string,
  type = 'pastoral_alert',
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO notifications (id, tenant_id, user_id, type, channel, status, title, body, metadata, updated_at)
     VALUES (
       $1::uuid, $2::uuid, $3::uuid,
       $4::"notification_type",
       'email'::"notification_channel",
       'pending'::"notification_status",
       'Email RLS Test', 'Body', '{"recipientEmail":"test@example.com"}', now()
     ) ON CONFLICT (id) DO NOTHING`,
    id, tenantId, userId, type,
  );
}

/** Read notifications visible to tenantId (app role, RLS enforced). */
async function readVisible(prisma: PrismaClient, tenantId: string): Promise<string[]> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRaw<Array<{ id: string }>>`SELECT id::text FROM notifications`;
  });
  return rows.map((r) => r.id);
}

/** Redis rate key for email channel (mirrors email-rate-limiter.service.ts). */
function rateKey(tenantId: string): string {
  const now = new Date();
  const dateStr =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  return `rate:email:${tenantId}:${dateStr}`;
}

// ─── Global setup/teardown ───────────────────────────────────────────────────

beforeAll(async () => {
  const privAdapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const appAdapter = new PrismaPg({
    connectionString: process.env.DATABASE_APP_URL!,
  });
  privileged = new PrismaClient({ adapter: privAdapter });
  app = new PrismaClient({ adapter: appAdapter });

  redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? '6380'),
    lazyConnect: false,
  });

  await ensureTenant(privileged, TENANT_A_ID, 'Igreja Alpha');
  await ensureTenant(privileged, TENANT_B_ID, 'Igreja Beta');
  await ensureUser(privileged, USER_EA, 'user-email-a@rls-test.com');
  await ensureUser(privileged, USER_EB, 'user-email-b@rls-test.com');

  await insertEmailNotification(privileged, EMAIL_A1_ID, TENANT_A_ID, USER_EA, 'pastoral_alert');
  await insertEmailNotification(privileged, EMAIL_A2_ID, TENANT_A_ID, USER_EA, 'export_ready');
  await insertEmailNotification(privileged, EMAIL_B1_ID, TENANT_B_ID, USER_EB, 'content_new');
  await insertEmailNotification(privileged, EMAIL_B2_ID, TENANT_B_ID, USER_EB, 'meeting_reminder');
});

afterAll(async () => {
  await privileged.$executeRawUnsafe(
    `DELETE FROM notifications WHERE id IN ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
    EMAIL_A1_ID, EMAIL_A2_ID, EMAIL_B1_ID, EMAIL_B2_ID,
  ).catch(() => {/* best-effort */});

  const keyA = rateKey(TENANT_A_ID);
  const keyB = rateKey(TENANT_B_ID);
  await redis.del(keyA, `${keyA}:alerted`, keyB, `${keyB}:alerted`).catch(() => {/* best-effort */});
  await redis.quit().catch(() => {/* best-effort */});
  await privileged.$disconnect().catch(() => {/* best-effort */});
  await app.$disconnect().catch(() => {/* best-effort */});
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Cross-tenant isolation in notifications table
// ─────────────────────────────────────────────────────────────────────────────

describe('RLS: email notifications — cross-tenant isolation', () => {
  it('Tenant A sees only its own notifications (USING policy)', async () => {
    const ids = await readVisible(app, TENANT_A_ID);
    expect(ids).toContain(EMAIL_A1_ID);
    expect(ids).toContain(EMAIL_A2_ID);
    expect(ids).not.toContain(EMAIL_B1_ID);
    expect(ids).not.toContain(EMAIL_B2_ID);
  });

  it('Tenant B does NOT see Tenant A notifications', async () => {
    const ids = await readVisible(app, TENANT_B_ID);
    expect(ids).toContain(EMAIL_B1_ID);
    expect(ids).toContain(EMAIL_B2_ID);
    expect(ids).not.toContain(EMAIL_A1_ID);
    expect(ids).not.toContain(EMAIL_A2_ID);
  });

  it('SELECT without SET LOCAL returns 0 rows (GUC vazio = policy false)', async () => {
    // Without SET LOCAL, app.current_tenant_id is unset → NULLIF → NULL → policy false
    const rows = await app.$queryRaw<Array<{ id: string }>>`
      SELECT id::text FROM notifications
      WHERE id = ANY(ARRAY[${EMAIL_A1_ID}::uuid, ${EMAIL_B1_ID}::uuid])
    `;
    expect(rows).toHaveLength(0);
  });

  it('WITH CHECK: INSERT with wrong tenant_id is blocked for app role', async () => {
    await expect(
      app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        await tx.$executeRawUnsafe(
          `INSERT INTO notifications (id, tenant_id, user_id, type, channel, status, title, body, metadata, updated_at)
           VALUES (
             gen_random_uuid(), $1::uuid, $2::uuid,
             'pastoral_alert'::"notification_type",
             'email'::"notification_channel",
             'pending'::"notification_status",
             'Spoofed', 'Body', '{}', now()
           )`,
          TENANT_B_ID, // wrong tenant_id injected into Tenant A context
          USER_EA,
        );
      }),
    ).rejects.toThrow();
  });

  it('export_ready and content_new types accepted by RLS policy', async () => {
    const idsA = await readVisible(app, TENANT_A_ID);
    const idsB = await readVisible(app, TENANT_B_ID);
    // Tenant A has export_ready; Tenant B has content_new
    expect(idsA).toContain(EMAIL_A2_ID);
    expect(idsB).toContain(EMAIL_B1_ID);
  });

  it('is idempotent — re-seeding does not error (ON CONFLICT DO NOTHING)', async () => {
    await expect(
      insertEmailNotification(privileged, EMAIL_A1_ID, TENANT_A_ID, USER_EA, 'pastoral_alert'),
    ).resolves.not.toThrow();
    await expect(
      insertEmailNotification(privileged, EMAIL_B1_ID, TENANT_B_ID, USER_EB, 'content_new'),
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Redis rate-limit namespace isolation (NFR-I1)
// ─────────────────────────────────────────────────────────────────────────────

describe('RLS: Redis rate-limit counters are namespaced by tenant', () => {
  const KEY_A = rateKey(TENANT_A_ID);
  const KEY_B = rateKey(TENANT_B_ID);

  beforeAll(async () => {
    await redis.set(KEY_A, '45', 'EX', 3600);
    await redis.set(KEY_B, '75', 'EX', 3600);
  });

  afterAll(async () => {
    await redis.del(KEY_A, KEY_B).catch(() => {/* best-effort */});
  });

  it('keys are distinct and contain tenantId', () => {
    expect(KEY_A).not.toBe(KEY_B);
    expect(KEY_A).toContain(TENANT_A_ID);
    expect(KEY_B).toContain(TENANT_B_ID);
  });

  it('Tenant A counter is independent of Tenant B counter', async () => {
    const countA = await redis.get(KEY_A);
    const countB = await redis.get(KEY_B);
    expect(countA).toBe('45');
    expect(countB).toBe('75');
  });

  it('incrementing Tenant A does NOT affect Tenant B', async () => {
    await redis.incr(KEY_A); // 45 → 46
    const countA = await redis.get(KEY_A);
    const countB = await redis.get(KEY_B);
    expect(countA).toBe('46');
    expect(countB).toBe('75'); // unchanged
  });

  it('is idempotent — second run with same keys does not conflict', async () => {
    await expect(redis.set(KEY_A, '45', 'EX', 3600)).resolves.not.toThrow();
  });
});
