/**
 * Seed: fictional trail records for Story 4-4 integration tests.
 *
 * Trails are created under the DEMO_TENANT_ID so they coexist with the
 * existing demo-seed without collision. IDs are fixed UUID v7s.
 *
 * Run standalone:
 *   pnpm --filter api exec ts-node prisma/seeds/group-trails-seed.ts
 *
 * Or it is called by demo-seed.ts (see bottom of this file for import usage).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ---------------------------------------------------------------------------
// Exported fixed IDs (reusable in tests)
// ---------------------------------------------------------------------------
export const SEED_TRAIL_DISCIPULADO_ID = '019756c0-4401-7000-8000-000000000010';
export const SEED_TRAIL_EVANGELISMO_ID = '019756c0-4401-7000-8000-000000000011';
export const SEED_TRAIL_LIDERANCA_ID   = '019756c0-4401-7000-8000-000000000012';

// Re-exported for convenience in tests
export { DEMO_TENANT_ID } from './demo-seed';

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------
export async function seedGroupTrails(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
) {
  const trails = [
    {
      id: SEED_TRAIL_DISCIPULADO_ID,
      name: 'Fundamentos do Discipulado',
      description:
        'Trilha formativa que conduz o participante pelos princípios do discipulado cristão.',
    },
    {
      id: SEED_TRAIL_EVANGELISMO_ID,
      name: 'Evangelismo Relacional',
      description:
        'Conteúdo prático para desenvolver uma cultura evangelizadora no grupo.',
    },
    {
      id: SEED_TRAIL_LIDERANCA_ID,
      name: 'Formação de Líderes',
      description:
        'Capacitação de líderes de pequenos grupos para pastoreio e cuidado.',
    },
  ];

  for (const trail of trails) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      // Upsert: idempotent re-runs
      await tx.$executeRawUnsafe(`
        INSERT INTO trails (id, tenant_id, name, description, status, created_by, updated_at)
        VALUES (
          '${trail.id}'::uuid,
          '${tenantId}'::uuid,
          '${trail.name.replace(/'/g, "''")}',
          '${trail.description.replace(/'/g, "''")}',
          'published',
          '${adminId}'::uuid,
          now()
        )
        ON CONFLICT (id) DO NOTHING
      `);
    });
  }

  return trails;
}

// ---------------------------------------------------------------------------
// Standalone runner
// ---------------------------------------------------------------------------
async function main() {
  const connectionString = process.env.DATABASE_APP_URL;
  if (!connectionString) throw new Error('DATABASE_APP_URL missing');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  await prisma.$connect();

  // Use demo tenant + admin for standalone run
  const { DEMO_TENANT_ID } = await import('./demo-seed');
  const DEMO_ADMIN_ID = '019899a0-7002-7000-8000-000000000002';

  try {
    const trails = await seedGroupTrails(prisma, DEMO_TENANT_ID, DEMO_ADMIN_ID);
    console.log(`Seeded ${trails.length} fictional trails under demo tenant.`);
    for (const t of trails) console.log(`  - ${t.id}: ${t.name}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === __filename) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
