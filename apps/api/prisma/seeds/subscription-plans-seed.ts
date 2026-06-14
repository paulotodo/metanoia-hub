/**
 * Seed canonical SubscriptionPlan rows (free / pro / enterprise).
 * Idempotent: upsert by `tier` — safe to run multiple times.
 *
 * Story 11-1 / US1 AC#2, AC#3, C4 (canonical values from spec.md §Constraints).
 *
 * Values: spec.md is authoritative — do NOT use the pre-flight planning artifact 11-1.
 *   free:       maxGroups=3,    maxMembersPerGroup=30,   maxLeadersPerTenant=5
 *   pro:        maxGroups=25,   maxMembersPerGroup=100,  maxLeadersPerTenant=50
 *   enterprise: null limits (unlimited — getLimits maps null→Infinity at runtime)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { uuidv7 } from 'uuidv7';

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL not set');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const plans = [
      {
        tier: 'free',
        name: 'Free',
        limits: { maxGroups: 3, maxMembersPerGroup: 30, maxLeadersPerTenant: 5 },
        features: {} as Record<string, unknown>,
        metadata: { priceBRL: 0 } as Record<string, unknown>,
      },
      {
        tier: 'pro',
        name: 'Pro',
        limits: { maxGroups: 25, maxMembersPerGroup: 100, maxLeadersPerTenant: 50 },
        features: {} as Record<string, unknown>,
        metadata: { priceBRL: 99 } as Record<string, unknown>,
      },
      {
        tier: 'enterprise',
        name: 'Enterprise',
        limits: { maxGroups: null, maxMembersPerGroup: null, maxLeadersPerTenant: null },
        features: {} as Record<string, unknown>,
        metadata: { price: 'Sob consulta' } as Record<string, unknown>,
      },
    ];

    for (const plan of plans) {
      await prisma.subscriptionPlan.upsert({
        where: { tier: plan.tier },
        update: {
          name: plan.name,
          limits: plan.limits,
          features: plan.features,
          metadata: plan.metadata,
          isActive: true,
        },
        create: {
          id: uuidv7(),
          tier: plan.tier,
          name: plan.name,
          limits: plan.limits,
          features: plan.features,
          metadata: plan.metadata,
          isActive: true,
        },
      });
      console.log(`Upserted plan: ${plan.tier}`);
    }

    const count = await prisma.subscriptionPlan.count();
    console.log(`subscription_plans total rows: ${count}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Guard CLI: only auto-run when executed directly (not imported by tests or API boot)
if (process.argv[1]?.includes('subscription-plans-seed')) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main as seedSubscriptionPlans };
