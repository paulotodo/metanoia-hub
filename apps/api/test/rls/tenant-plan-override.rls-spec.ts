/**
 * RLS isolation tests for `tenants.plan_limits_override` column.
 * Tenant A's override must not be visible to Tenant B's session.
 *
 * Story 11-1 / FR-INFRA-06, US5 AC#4.
 *
 * Tests verify:
 *  1. Tenant A can set its own plan_limits_override
 *  2. With Tenant B's tenant context, SELECT on Tenant A's row returns 0 rows
 *     (existing tenants RLS policy blocks cross-tenant reads)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Use fixed IDs distinct from the shared TENANT_A/B to avoid clobbering other specs
const OVERRIDE_TENANT_A = '01900002-0000-7000-8000-000000000001';
const OVERRIDE_TENANT_B = '01900002-0000-7000-8000-000000000002';

function makeAppClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_APP_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function makePrivilegedClient(): PrismaClient {
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

  // Seed two tenant rows via privileged connection (bypass RLS).
  // beforeEach must NOT delete these rows (gotcha: users global table uses same helper pattern).
  for (const [id, name] of [
    [OVERRIDE_TENANT_A, 'Override Tenant A'],
    [OVERRIDE_TENANT_B, 'Override Tenant B'],
  ] as [string, string][]) {
    await privilegedClient.$executeRawUnsafe(`
      INSERT INTO tenants (id, tenant_id, name, created_at, updated_at)
      VALUES ('${id}'::uuid, '${id}'::uuid, '${name}', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
  }
});

afterAll(async () => {
  // Cleanup only mutable fields / inserted rows
  await privilegedClient.$executeRawUnsafe(
    `UPDATE tenants SET plan_limits_override = NULL WHERE id IN ('${OVERRIDE_TENANT_A}'::uuid, '${OVERRIDE_TENANT_B}'::uuid)`,
  );
  await privilegedClient.$disconnect();
  await appClient.$disconnect();
});

describe('tenant plan_limits_override RLS isolation', () => {
  it('Tenant A can set its own plan_limits_override', async () => {
    await appClient.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${OVERRIDE_TENANT_A}'`,
      );
      await tx.$executeRawUnsafe(`
        UPDATE tenants
        SET plan_limits_override = '{"maxGroups":10}'::jsonb
        WHERE id = '${OVERRIDE_TENANT_A}'::uuid
      `);
    });

    // Verify with privileged connection
    const rows = await privilegedClient.$queryRawUnsafe<{ plan_limits_override: unknown }[]>(
      `SELECT plan_limits_override FROM tenants WHERE id = '${OVERRIDE_TENANT_A}'::uuid`,
    );
    expect(rows).toHaveLength(1);
    const override = rows[0]?.plan_limits_override as Record<string, number>;
    expect(override['maxGroups']).toBe(10);
  });

  it('Tenant B session cannot read Tenant A plan_limits_override', async () => {
    // With current_tenant_id = Tenant B, SELECT on Tenant A's row should return 0 rows
    // because the existing tenants RLS policy (tenant_id = current_setting(...)) blocks it.
    const rows = await appClient.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${OVERRIDE_TENANT_B}'`,
      );
      return tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM tenants WHERE id = '${OVERRIDE_TENANT_A}'::uuid`,
      );
    });

    expect(rows).toHaveLength(0);
  });
});
