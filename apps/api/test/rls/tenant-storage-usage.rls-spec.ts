import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * RLS isolation test — tenant_storage_usage
 *
 * Verifica que a política nullif permite que super-admin leia dados cross-tenant
 * e que tenants isolados só veem seus próprios registros.
 *
 * Requer: banco de teste rodando (docker-compose.test.yml)
 * Executar: pnpm --filter @metanoia/api test apps/api/test/rls/tenant-storage-usage.rls-spec.ts
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://metanoia:metanoia_dev_pass@localhost:5433/metanoia_test';
const APP_URL = process.env.DATABASE_APP_URL ?? 'postgresql://metanoia_app:metanoia_app_pass@localhost:5433/metanoia_test';

// Two test tenant IDs
const TENANT_A = '018e5b3c-0000-7000-8000-000000000a01';
const TENANT_B = '018e5b3c-0000-7000-8000-000000000b02';

function createClient(_tenantId: string | null): PrismaClient {
  const adapter = new PrismaPg({ connectionString: APP_URL });
  return new PrismaClient({ adapter });
}

async function setTenantContext(client: PrismaClient, tenantId: string | null): Promise<void> {
  if (tenantId) {
    await client.$executeRawUnsafe(`SET app.current_tenant_id = '${tenantId}'`);
  } else {
    await client.$executeRaw`SET app.current_tenant_id = ''`;
  }
}

describe('tenant_storage_usage RLS isolation', () => {
  let privileged: PrismaClient;

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: DATABASE_URL });
    privileged = new PrismaClient({ adapter });
    await privileged.$connect();

    // Seed two rows
    await privileged.$executeRaw`
      INSERT INTO tenant_storage_usage (tenant_id, bytes_used)
      VALUES (${TENANT_A}::uuid, 1024), (${TENANT_B}::uuid, 2048)
      ON CONFLICT (tenant_id) DO UPDATE SET bytes_used = EXCLUDED.bytes_used
    `;
  });

  afterAll(async () => {
    await privileged.$executeRaw`
      DELETE FROM tenant_storage_usage WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)
    `;
    await privileged.$disconnect();
  });

  it('super-admin (privileged, bypass RLS) sees all rows cross-tenant', async () => {
    // Super-admin reads cross-tenant via privileged connection (DATABASE_URL superuser, bypasses RLS)
    const rows = await privileged.$queryRaw<Array<{ tenant_id: string }>>`
      SELECT tenant_id FROM tenant_storage_usage
      WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)
    `;
    expect(rows.length).toBe(2);
  });

  it('app role without tenant context sees 0 rows (closed-by-default)', async () => {
    const client = createClient(null);
    await client.$connect();
    try {
      await setTenantContext(client, null);
      const rows = await client.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT tenant_id FROM tenant_storage_usage
        WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)
      `;
      expect(rows.length).toBe(0);
    } finally {
      await client.$disconnect();
    }
  });

  it('tenant A sees only its own row', async () => {
    const client = createClient(TENANT_A);
    await client.$connect();
    try {
      await setTenantContext(client, TENANT_A);
      const rows = await client.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT tenant_id FROM tenant_storage_usage
        WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].tenant_id).toBe(TENANT_A);
    } finally {
      await client.$disconnect();
    }
  });

  it('tenant B sees only its own row', async () => {
    const client = createClient(TENANT_B);
    await client.$connect();
    try {
      await setTenantContext(client, TENANT_B);
      const rows = await client.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT tenant_id FROM tenant_storage_usage
        WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].tenant_id).toBe(TENANT_B);
    } finally {
      await client.$disconnect();
    }
  });

  it('UPSERT increments bytes_used correctly', async () => {
    const client = createClient(TENANT_A);
    await client.$connect();
    try {
      await setTenantContext(client, TENANT_A);
      const before = await client.$queryRaw<Array<{ bytes_used: bigint }>>`
        SELECT bytes_used FROM tenant_storage_usage WHERE tenant_id = ${TENANT_A}::uuid
      `;
      const beforeBytes = before[0]?.bytes_used ?? BigInt(0);

      // Simulate hook UPSERT
      await client.$executeRaw`
        INSERT INTO tenant_storage_usage (tenant_id, bytes_used, updated_at)
        VALUES (${TENANT_A}::uuid, ${BigInt(512)}, now())
        ON CONFLICT (tenant_id)
        DO UPDATE SET
          bytes_used = tenant_storage_usage.bytes_used + ${BigInt(512)},
          updated_at = now()
      `;

      const after = await client.$queryRaw<Array<{ bytes_used: bigint }>>`
        SELECT bytes_used FROM tenant_storage_usage WHERE tenant_id = ${TENANT_A}::uuid
      `;
      expect(Number(after[0]?.bytes_used)).toBe(Number(beforeBytes) + 512);
    } finally {
      await client.$disconnect();
    }
  });
});
