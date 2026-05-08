import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Story 7-2 — Cleanup demo tenants.
 *
 * Deletes every tenant flagged `is_demo=true` and all rows that reference it.
 * Most tenant-scoped tables in this schema do NOT carry FK constraints to
 * `tenants` (RLS is the isolation guarantee, not referential integrity), so
 * the cleanup walks the dependency graph application-side. Order matters —
 * leaves first, roots last.
 *
 * Idempotent: a re-run with no demo tenants present is a no-op. Safe to run
 * before `db:seed:demo` to start from a clean slate.
 *
 * Usage: pnpm --filter @metanoia/api db:seed:demo:clean
 */

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://metanoia:metanoia_dev_pass@localhost:5432/metanoia_dev';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const demoTenants = await prisma.tenant.findMany({
    where: { isDemo: true },
    select: { id: true, name: true },
  });

  if (demoTenants.length === 0) {
    console.log('No demo tenants found — nothing to clean.');
    return;
  }

  const ids = demoTenants.map((t) => t.id);
  console.log(
    `Cleaning ${demoTenants.length} demo tenant(s): ${demoTenants
      .map((t) => `${t.name} (${t.id})`)
      .join(', ')}`,
  );

  const tenantScope = { tenantId: { in: ids } };

  // Pass 1 — leaves that reference Group/User/Meeting.
  await prisma.pastoralNote.deleteMany({ where: tenantScope });
  await prisma.pastoralAction.deleteMany({ where: tenantScope });
  await prisma.pastoralAlert.deleteMany({ where: tenantScope });
  await prisma.outreachIntent.deleteMany({ where: tenantScope });
  await prisma.meetingEvent.deleteMany({ where: tenantScope });

  // Pass 2 — Meeting (cascades to MeetingParticipantRecord and Reflection
  // via onDelete: Cascade declared on those models).
  await prisma.meeting.deleteMany({ where: tenantScope });

  // Pass 3 — group memberships and groups.
  await prisma.groupMember.deleteMany({ where: tenantScope });
  await prisma.group.deleteMany({ where: tenantScope });

  // Pass 4 — user-side rows scoped to demo tenant.
  await prisma.consent.deleteMany({ where: tenantScope });
  await prisma.userTenant.deleteMany({ where: tenantScope });
  await prisma.user.deleteMany({ where: tenantScope });

  // Pass 5 — invites and the tenant rows themselves.
  await prisma.invite.deleteMany({ where: tenantScope });
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } });

  console.log('Demo cleanup concluído.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Demo cleanup failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
