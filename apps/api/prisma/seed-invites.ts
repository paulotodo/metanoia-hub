import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { uuidv7 } from 'uuidv7';

/**
 * Seed script for invite fixtures (Cenário 05 — Admin Onboarding).
 *
 * Mirrors apps/web/__mocks__/onboarding/invites.ts token strings and states so
 * FE fixtures and BE rows stay in sync for E2E and manual QA.
 *
 * Usage: tsx prisma/seed-invites.ts
 *
 * States seeded:
 *   - valid     (fresh, expires 7 days from now)
 *   - expired   (expires 1 day ago)
 *   - used      (usedAt set, linked to an existing demo tenant)
 *
 * NOT seeded (by design):
 *   - invalid   — covered by "token not found"
 *   - network   — covered by FE fetch simulation
 */

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://metanoia:metanoia_dev_pass@localhost:5432/metanoia_dev';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const INVITES = [
  {
    id: uuidv7(),
    token: 'inv_valid_019ABC000001',
    leaderName: 'Pastor João Batista',
    leaderEmail: 'joao@igrejaexemplo.org',
    churchName: 'Igreja Exemplo',
    expiresAt: new Date(now + 7 * DAY_MS),
    usedAt: null as Date | null,
    tenantId: null as string | null,
  },
  {
    id: uuidv7(),
    token: 'inv_expired_019ABC000002',
    leaderName: 'Pastora Ruth Lima',
    leaderEmail: 'ruth@novavida.org',
    churchName: 'Igreja Nova Vida',
    expiresAt: new Date(now - 1 * DAY_MS),
    usedAt: null as Date | null,
    tenantId: null as string | null,
  },
  {
    id: uuidv7(),
    token: 'inv_used_019ABC000003',
    leaderName: 'Pastor Marcos Silva',
    leaderEmail: 'marcos@vidanova.org',
    churchName: 'Igreja Vida Nova',
    expiresAt: new Date(now + 7 * DAY_MS),
    usedAt: new Date(now - 2 * DAY_MS),
    // Intentionally linked to the radar demo tenant so "used" invites map to a real tenant.
    tenantId: '019756a0-0001-7000-8000-000000000001',
  },
] as const;

async function main() {
  console.log('Seeding onboarding invite fixtures...');

  for (const inv of INVITES) {
    await prisma.invite.upsert({
      where: { token: inv.token },
      update: {
        leaderName: inv.leaderName,
        leaderEmail: inv.leaderEmail,
        churchName: inv.churchName,
        expiresAt: inv.expiresAt,
        usedAt: inv.usedAt,
        tenantId: inv.tenantId,
      },
      create: {
        id: inv.id,
        token: inv.token,
        leaderName: inv.leaderName,
        leaderEmail: inv.leaderEmail,
        churchName: inv.churchName,
        expiresAt: inv.expiresAt,
        usedAt: inv.usedAt,
        tenantId: inv.tenantId,
      },
    });
    console.log(`  - ${inv.token} (${inv.usedAt ? 'used' : inv.expiresAt.getTime() < now ? 'expired' : 'valid'})`);
  }

  console.log(`Seeded ${INVITES.length} invites.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
