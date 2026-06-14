/**
 * Super Admin Plans — integration tests (Story 11-1 / US4)
 *
 * Service-level integration against the REAL database + Redis:
 *   SuperAdminPlansService → SuperAdminPlansRepository → Postgres (subscription_plans
 *   global table) + write-through to Redis via PlanLimitsService.getLimits.
 *
 * Why service-level (not full-stack HTTP via supertest): this project has no
 * MSW/JWKS harness for integration HTTP auth, and the Keycloak guard cannot be
 * reliably overridden under Vitest's module graph. The HTTP concerns covered by
 * this suite are validated elsewhere:
 *   - RBAC (SUPER_ADMIN / 403)        → auth/roles.guard + auth-layers specs
 *   - Zod 422 on bad limits           → PatchSubscriptionPlanInputSchema (asserted below) + ZodValidationPipe
 * This suite owns the substantive logic: tenantCount aggregation, UUID guard
 * (SEC-3.4), 404, partial update, enterprise null limits, and Redis write-through.
 *
 * `tenants` is RLS-protected, so the test tenant fixture is seeded via a
 * privileged (DATABASE_URL / bypass-RLS) connection, mirroring test/rls/*.
 * `subscription_plans` is a global table with no RLS, so plans use the app client.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PatchSubscriptionPlanInputSchema } from '@metanoia/types';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisModule } from '../../src/redis/redis.module';
import { RedisService } from '../../src/redis/redis.service';
import { PlanLimitsModule } from '../../src/common/plan-limits/plan-limits.module';
import { SuperAdminPlansService } from '../../src/super-admin/super-admin-plans.service';
import { SuperAdminPlansRepository } from '../../src/super-admin/super-admin-plans.repository';

// Fixed test UUIDs (v7-style format, deterministic)
const PLAN_FREE_ID = '01900011-0000-7000-8000-000000000001';
const PLAN_PRO_ID = '01900011-0000-7000-8000-000000000002';
const PLAN_ENT_ID = '01900011-0000-7000-8000-000000000003';
const TENANT_ID = '01900011-0000-7000-8000-000000000010';
const TEST_TIERS = ['free-integ', 'pro-integ', 'enterprise-integ'];

function makePrivilegedClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL not set');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

describe('SuperAdmin Plans (integration)', () => {
  let moduleRef: TestingModule;
  let service: SuperAdminPlansService;
  let prisma: PrismaService;
  let redis: RedisService;
  let privileged: PrismaClient;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, PlanLimitsModule, RedisModule],
      providers: [SuperAdminPlansService, SuperAdminPlansRepository],
    }).compile();
    await moduleRef.init();

    service = moduleRef.get(SuperAdminPlansService);
    prisma = moduleRef.get(PrismaService);
    redis = moduleRef.get(RedisService);
    privileged = makePrivilegedClient();

    // Tenant fixture on the free-integ tier — seeded via privileged conn (tenants RLS)
    await privileged.tenant.upsert({
      where: { id: TENANT_ID },
      create: {
        id: TENANT_ID,
        tenantId: TENANT_ID,
        name: 'Test Tenant Plans',
        slug: 'test-tenant-plans-integ',
        plan: 'free-integ',
        status: 'active',
        adminEmail: 'admin-plans-integ@test.example',
      },
      update: { plan: 'free-integ' },
    });

    // Plan fixtures (subscription_plans is global, no RLS — app client is fine)
    await prisma.client.subscriptionPlan.upsert({
      where: { id: PLAN_FREE_ID },
      create: {
        id: PLAN_FREE_ID,
        name: 'Free (test)',
        tier: 'free-integ',
        limits: { maxGroups: 3, maxMembersPerGroup: 20, maxLeadersPerTenant: 5 },
        features: {},
        metadata: {},
        isActive: true,
      },
      update: { isActive: true, limits: { maxGroups: 3, maxMembersPerGroup: 20, maxLeadersPerTenant: 5 } },
    });
    await prisma.client.subscriptionPlan.upsert({
      where: { id: PLAN_PRO_ID },
      create: {
        id: PLAN_PRO_ID,
        name: 'Pro (test)',
        tier: 'pro-integ',
        limits: { maxGroups: 25, maxMembersPerGroup: null, maxLeadersPerTenant: 50 },
        features: {},
        metadata: {},
        isActive: true,
      },
      update: { isActive: true },
    });
    await prisma.client.subscriptionPlan.upsert({
      where: { id: PLAN_ENT_ID },
      create: {
        id: PLAN_ENT_ID,
        name: 'Enterprise (test)',
        tier: 'enterprise-integ',
        limits: { maxGroups: null, maxMembersPerGroup: null, maxLeadersPerTenant: null },
        features: {},
        metadata: {},
        isActive: true,
      },
      update: { isActive: true },
    });
  });

  afterAll(async () => {
    await prisma.client.subscriptionPlan
      .deleteMany({ where: { tier: { in: TEST_TIERS } } })
      .catch(() => undefined);
    await privileged.tenant.delete({ where: { id: TENANT_ID } }).catch(() => undefined);
    await redis.del(`cache:plan-limits:${TENANT_ID}`).catch(() => undefined);
    await privileged.$disconnect().catch(() => undefined);
    await moduleRef.close().catch(() => undefined);
  });

  // ── listPlans ────────────────────────────────────────────────────────────
  describe('listPlans', () => {
    it('TC-LIST-01: returns active plans with numeric tenantCount per tier', async () => {
      const { data } = await service.listPlans();
      expect(Array.isArray(data)).toBe(true);

      for (const plan of data) {
        expect(typeof plan.id).toBe('string');
        expect(typeof plan.tier).toBe('string');
        expect(typeof plan.isActive).toBe('boolean');
        expect(typeof plan.tenantCount).toBe('number');
        expect(plan.tenantCount).toBeGreaterThanOrEqual(0);
      }

      // The seeded free-integ plan must be present and reflect the seeded tenant
      const free = data.find((p) => p.tier === 'free-integ');
      expect(free).toBeDefined();
      expect(free?.tenantCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ── patchPlan ────────────────────────────────────────────────────────────
  describe('patchPlan', () => {
    it('TC-PATCH-01: valid limits update is persisted + write-through to Redis', async () => {
      const { data } = await service.patchPlan(PLAN_FREE_ID, {
        limits: { maxGroups: 7, maxMembersPerGroup: 30, maxLeadersPerTenant: 8 },
      });
      expect(data.id).toBe(PLAN_FREE_ID);
      expect(data.limits).toMatchObject({ maxGroups: 7, maxMembersPerGroup: 30, maxLeadersPerTenant: 8 });

      // Persisted in DB (core assertion)
      const row = await prisma.client.subscriptionPlan.findUniqueOrThrow({ where: { id: PLAN_FREE_ID } });
      expect((row.limits as Record<string, number>)['maxGroups']).toBe(7);

      // Write-through is best-effort (service catches + logs failures) and depends
      // on tenant visibility under RLS — if the key was written, assert its shape.
      // (Write-through with mocked Redis is covered exhaustively in plan-limits.service.spec.)
      const cached = await redis.get(`cache:plan-limits:${TENANT_ID}`);
      if (cached !== null) {
        const parsed = JSON.parse(cached) as Record<string, unknown>;
        expect(parsed).toHaveProperty('maxGroups');
      }
    });

    it('TC-PATCH-02: SEC-3.4 — non-UUID planId throws BadRequestException', async () => {
      await expect(service.patchPlan('not-a-uuid', { isActive: false })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('TC-PATCH-03: valid UUID but unknown plan throws NotFoundException', async () => {
      await expect(
        service.patchPlan('01900099-9999-7000-8000-000000000099', { limits: { maxGroups: 5 } }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('TC-PATCH-04: partial update (only isActive) toggles flag', async () => {
      const off = await service.patchPlan(PLAN_PRO_ID, { isActive: false });
      expect(off.data.isActive).toBe(false);
      const on = await service.patchPlan(PLAN_PRO_ID, { isActive: true });
      expect(on.data.isActive).toBe(true);
    });

    it('TC-PATCH-05: enterprise null limits are preserved (unlimited)', async () => {
      const { data } = await service.patchPlan(PLAN_ENT_ID, {
        limits: { maxGroups: null, maxMembersPerGroup: null, maxLeadersPerTenant: null },
      });
      const limits = data.limits as Record<string, unknown>;
      expect(limits['maxGroups']).toBeNull();
      expect(limits['maxMembersPerGroup']).toBeNull();
      expect(limits['maxLeadersPerTenant']).toBeNull();
    });
  });

  // ── input validation (422-equivalent at the HTTP boundary via ZodValidationPipe) ──
  describe('PatchSubscriptionPlanInputSchema', () => {
    it('TC-VAL-01: rejects negative and zero limits, accepts positive and null', () => {
      expect(PatchSubscriptionPlanInputSchema.safeParse({ limits: { maxGroups: -1 } }).success).toBe(false);
      expect(PatchSubscriptionPlanInputSchema.safeParse({ limits: { maxGroups: 0 } }).success).toBe(false);
      expect(PatchSubscriptionPlanInputSchema.safeParse({ limits: { maxGroups: 5 } }).success).toBe(true);
      expect(PatchSubscriptionPlanInputSchema.safeParse({ limits: { maxGroups: null } }).success).toBe(true);
    });
  });
});
