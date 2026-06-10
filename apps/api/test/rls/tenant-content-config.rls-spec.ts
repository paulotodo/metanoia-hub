import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Unique fixed UUIDs for this spec (avoid CI parallel collisions)
const CONFIG_A_ID = '01975800-0001-7000-8000-000000000a01';
const CONFIG_B_ID = '01975800-0001-7000-8000-000000000b01';

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedConfig(
  prisma: PrismaClient,
  tenantId: string,
  configId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenant_content_config
         (id, tenant_id, video_threshold_percent, doc_scroll_threshold_percent,
          allow_manual_video_completion, allow_manual_doc_completion, updated_at)
       VALUES ('${configId}'::uuid, '${tenantId}'::uuid, 90, 80, false, false, now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function readConfigs(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.tenantContentConfig.findMany();
  });
}

async function cleanupConfigs(prisma: PrismaClient, ids: string[]) {
  // Cleanup without RLS (bypass via raw DELETE)
  for (const id of ids) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM tenant_content_config WHERE id = '${id}'::uuid`,
    );
  }
}

describe('RLS Isolation: tenant_content_config table', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
  });

  beforeEach(async () => {
    // Clean only the mutable config rows between tests
    await cleanupConfigs(prisma, [CONFIG_A_ID, CONFIG_B_ID]);
  });

  afterAll(async () => {
    await cleanupConfigs(prisma, [CONFIG_A_ID, CONFIG_B_ID]);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B config', async () => {
    await seedConfig(prisma, TENANT_A_ID, CONFIG_A_ID);
    await seedConfig(prisma, TENANT_B_ID, CONFIG_B_ID);

    const visibleToA = await readConfigs(prisma, TENANT_A_ID);
    const ids = visibleToA.map((c) => c.id);
    expect(ids).toContain(CONFIG_A_ID);
    expect(ids).not.toContain(CONFIG_B_ID);
  });

  it('tenant B cannot see tenant A config', async () => {
    await seedConfig(prisma, TENANT_A_ID, CONFIG_A_ID);
    await seedConfig(prisma, TENANT_B_ID, CONFIG_B_ID);

    const visibleToB = await readConfigs(prisma, TENANT_B_ID);
    const ids = visibleToB.map((c) => c.id);
    expect(ids).toContain(CONFIG_B_ID);
    expect(ids).not.toContain(CONFIG_A_ID);
  });

  it('empty tenant context returns no configs (NULLIF invariante)', async () => {
    await seedConfig(prisma, TENANT_A_ID, CONFIG_A_ID);

    const visible = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.tenantContentConfig.findMany();
    });
    expect(visible.map((c) => c.id)).not.toContain(CONFIG_A_ID);
  });

  it('config has correct defaults after insert', async () => {
    await seedConfig(prisma, TENANT_A_ID, CONFIG_A_ID);

    const [config] = await readConfigs(prisma, TENANT_A_ID);
    expect(config).toBeDefined();
    if (config) {
      expect(config.videoThresholdPercent).toBe(90);
      expect(config.docScrollThresholdPercent).toBe(80);
      expect(config.allowManualVideoCompletion).toBe(false);
      expect(config.allowManualDocCompletion).toBe(false);
    }
  });
});
