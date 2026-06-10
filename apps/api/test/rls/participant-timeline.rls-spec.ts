/**
 * RLS isolation tests for the participant individual timeline (Story 6-4).
 * Covers: pastoral_actions and meeting_attendance — both tenant-scoped.
 * Verifies: tenant_a cannot see tenant_b's timeline data and vice versa.
 *
 * NOTE: These tests require a running PostgreSQL instance with RLS enabled.
 * They run in CI via docker-compose.test.yml.
 *
 * Armadilhas RLS Prisma v7 (from prior cycles):
 * - Build client with PrismaPg adapter.
 * - UUIDs MUST be fixed hex-only (no generateId() for fixtures — not idempotent).
 * - users are GLOBAL: insert under zero-tenant context (00000000-...).
 * - users table has no tenant_id column — link via user_tenants.
 * - group_members does NOT have updated_at.
 * - CI runs all specs in parallel → unique emails/ids required per spec.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ---------------------------------------------------------------------------
// Fixed UUIDs — hex-valid, unique to this spec (prefix 0064)
// ---------------------------------------------------------------------------
const GROUP_A_ID = '01912345-6789-7000-8000-0000000064a1';
const GROUP_B_ID = '01912345-6789-7000-8000-0000000064b1';
const USER_A_ID = '01912345-6789-7000-8000-0000000064a2';
const USER_B_ID = '01912345-6789-7000-8000-0000000064b2';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

async function setupFixtures(prisma: PrismaClient): Promise<void> {
  // 1. Ensure tenants
  for (const [tenantId, name] of [
    [TENANT_A_ID, 'rls-tl-tenant-a'],
    [TENANT_B_ID, 'rls-tl-tenant-b'],
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

  // 2. Ensure users — GLOBAL (no tenant_id, under zero-tenant context)
  for (const [userId, email] of [
    [USER_A_ID, 'rls-tl-a@test.com'],
    [USER_B_ID, 'rls-tl-b@test.com'],
  ] as const) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000000'`,
      );
      await tx.$executeRawUnsafe(`
        INSERT INTO users (id, email, name, status, updated_at)
        VALUES ('${userId}'::uuid, '${email}', 'RLS TL User', 'active', NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    });
  }

  // 3. Ensure groups (one per tenant)
  for (const [groupId, tenantId, gname] of [
    [GROUP_A_ID, TENANT_A_ID, 'rls-tl-group-a'],
    [GROUP_B_ID, TENANT_B_ID, 'rls-tl-group-b'],
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

// ---------------------------------------------------------------------------
// Helpers to seed and read timeline data
// ---------------------------------------------------------------------------

async function seedCareAction(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
  participantId: string,
): Promise<string> {
  const id = generateId();
  const performedBy = participantId; // same user as performer for test simplicity
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO pastoral_actions
        (id, tenant_id, group_id, participant_id, performed_by, action_type, signal_type, recorded_at)
      VALUES
        ('${id}'::uuid, '${tenantId}'::uuid, '${groupId}'::uuid,
         '${participantId}'::uuid, '${performedBy}'::uuid,
         'message', 'care-urgent', NOW())
    `);
  });
  return id;
}

async function readCareActions(prisma: PrismaClient, tenantCtx: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    const rows = await tx.pastoralAction.findMany({
      select: { id: true, tenantId: true },
    });
    return rows.map((r) => r.id);
  });
}

async function seedAttendance(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
): Promise<string> {
  const id = generateId();
  const meetingId = generateId(); // ephemeral — no FK constraint check needed for meeting_attendance
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO meeting_attendance
        (id, tenant_id, meeting_id, user_id, join_time, leave_time,
         total_duration_seconds, presence_type)
      VALUES
        ('${id}'::uuid, '${tenantId}'::uuid, '${meetingId}'::uuid, '${userId}'::uuid,
         NOW() - INTERVAL '1 hour', NOW(), 3600, 'integral')
    `);
  });
  return id;
}

async function readAttendance(prisma: PrismaClient, tenantCtx: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    const rows = await tx.meetingAttendance.findMany({
      select: { id: true, tenantId: true },
    });
    return rows.map((r) => r.id);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('participant_timeline RLS isolation (Story 6-4)', () => {
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

  // pastoral_actions isolation
  describe('pastoral_actions', () => {
    it('tenant_a sees only tenant_a care actions', async () => {
      const actionA = await seedCareAction(prisma, TENANT_A_ID, GROUP_A_ID, USER_A_ID);
      const actionB = await seedCareAction(prisma, TENANT_B_ID, GROUP_B_ID, USER_B_ID);

      const visibleToA = await readCareActions(prisma, TENANT_A_ID);

      expect(visibleToA).toContain(actionA);
      expect(visibleToA).not.toContain(actionB);
    });

    it('tenant_b sees only tenant_b care actions', async () => {
      const actionA = await seedCareAction(prisma, TENANT_A_ID, GROUP_A_ID, USER_A_ID);
      const actionB = await seedCareAction(prisma, TENANT_B_ID, GROUP_B_ID, USER_B_ID);

      const visibleToB = await readCareActions(prisma, TENANT_B_ID);

      expect(visibleToB).toContain(actionB);
      expect(visibleToB).not.toContain(actionA);
    });

    it('no tenant context → sees nothing (RLS blocks all)', async () => {
      await seedCareAction(prisma, TENANT_A_ID, GROUP_A_ID, USER_A_ID);

      const visible = await readCareActions(prisma, '');

      expect(visible).toHaveLength(0);
    });
  });

  // meeting_attendance isolation
  describe('meeting_attendance', () => {
    it('tenant_a sees only tenant_a attendance', async () => {
      const attA = await seedAttendance(prisma, TENANT_A_ID, USER_A_ID);
      const attB = await seedAttendance(prisma, TENANT_B_ID, USER_B_ID);

      const visibleToA = await readAttendance(prisma, TENANT_A_ID);

      expect(visibleToA).toContain(attA);
      expect(visibleToA).not.toContain(attB);
    });

    it('tenant_b sees only tenant_b attendance', async () => {
      const attA = await seedAttendance(prisma, TENANT_A_ID, USER_A_ID);
      const attB = await seedAttendance(prisma, TENANT_B_ID, USER_B_ID);

      const visibleToB = await readAttendance(prisma, TENANT_B_ID);

      expect(visibleToB).toContain(attB);
      expect(visibleToB).not.toContain(attA);
    });

    it('no tenant context → sees nothing (RLS blocks all)', async () => {
      await seedAttendance(prisma, TENANT_A_ID, USER_A_ID);

      const visible = await readAttendance(prisma, '');

      expect(visible).toHaveLength(0);
    });
  });
});
