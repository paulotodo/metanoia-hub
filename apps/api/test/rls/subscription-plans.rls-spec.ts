/**
 * RLS authorization tests for `subscription_plans` — global table, no tenant isolation.
 * SUPER_ADMIN (bypass RLS) can write; app_user role (tenant context) cannot INSERT.
 *
 * Story 11-1 / FR-INFRA-06.
 *
 * Tests verify:
 *  1. Regular app_user session CANNOT INSERT into subscription_plans (no INSERT policy)
 *  2. SUPER_ADMIN (bypass RLS — direct pool) CAN UPDATE limits
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { uuidv7 } from 'uuidv7';
import { TENANT_A_ID } from './rls-test.helper';

const TEST_PLAN_ID = '01900001-0000-7000-8000-000000000099';

function makeAppClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_APP_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function makePrivilegedClient(): PrismaClient {
  // Uses DATABASE_URL (superuser / bypass-RLS connection) to seed test data.
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

let appClient: PrismaClient;
let privilegedClient: PrismaClient;

beforeAll(async () => {
  appClient = makeAppClient();
  privilegedClient = makePrivilegedClient();

  // Seed one plan row via privileged connection (bypass RLS)
  await privilegedClient.$executeRawUnsafe(`
    INSERT INTO subscription_plans (id, name, tier, limits, is_active, created_at, updated_at)
    VALUES (
      '${TEST_PLAN_ID}'::uuid,
      'Test Plan RLS',
      'rls_test_tier',
      '{"maxGroups":5,"maxMembersPerGroup":30,"maxLeadersPerTenant":5}'::jsonb,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `);
});

afterAll(async () => {
  // Cleanup: delete test row via privileged connection
  await privilegedClient.$executeRawUnsafe(
    `DELETE FROM subscription_plans WHERE id = '${TEST_PLAN_ID}'::uuid`,
  );
  await privilegedClient.$disconnect();
  await appClient.$disconnect();
});

describe('subscription_plans RLS authorization', () => {
  it('app_user session CANNOT INSERT into subscription_plans', async () => {
    // The app_user role has no INSERT policy on subscription_plans (global table).
    // Attempt to insert with a tenant context set.
    await expect(
      appClient.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`,
        );
        await tx.$executeRawUnsafe(`
          INSERT INTO subscription_plans (id, name, tier, limits, created_at, updated_at)
          VALUES (
            '${uuidv7()}'::uuid,
            'Unauthorized Plan',
            'unauthorized_tier',
            '{"maxGroups":1,"maxMembersPerGroup":1,"maxLeadersPerTenant":1}'::jsonb,
            NOW(),
            NOW()
          )
        `);
      }),
    ).rejects.toThrow();
  });

  it('privileged connection (bypass RLS) CAN UPDATE limits', async () => {
    const newLimits = JSON.stringify({ maxGroups: 10, maxMembersPerGroup: 50, maxLeadersPerTenant: 10 });
    await expect(
      privilegedClient.$executeRawUnsafe(`
        UPDATE subscription_plans
        SET limits = '${newLimits}'::jsonb, updated_at = NOW()
        WHERE id = '${TEST_PLAN_ID}'::uuid
      `),
    ).resolves.not.toThrow();

    // Verify update persisted
    const rows = await privilegedClient.$queryRawUnsafe<{ limits: unknown }[]>(
      `SELECT limits FROM subscription_plans WHERE id = '${TEST_PLAN_ID}'::uuid`,
    );
    expect(rows).toHaveLength(1);
    const limits = rows[0]?.limits as Record<string, number>;
    expect(limits['maxGroups']).toBe(10);
  });
});
