/**
 * Story 10-1 — Cenário 10: Roundtrip anti-drift (6.3).
 *
 * Verifies camelCase ↔ snake_case mapping across the full request/response
 * cycle for the onboarding-wizard write paths, without spinning up a real DB.
 *
 * Tests (NOT MSW — in-process with Prisma mocked):
 *   A. `PATCH /api/v1/users/me` → response camelCase + Zod parse without error.
 *      Confirms: profile_photo_url ↔ profilePhotoUrl, role_title ↔ roleTitle.
 *   B. `PATCH /api/v1/tenants/me` with onboardingProgress JSONB → roundtrip
 *      without loss (completedSteps, stepData, completed, etc.).
 *      Confirms: onboarding_progress ↔ onboardingProgress, logo_url ↔ logoUrl.
 *   C. `GET /api/v1/onboarding/status` → OnboardingStatusResponseSchema.parse()
 *      without error. Confirms field shape matches Zod contract.
 *
 * Anti-drift rationale (dec-019): if a column rename happens in schema.prisma
 * without updating the service mapping, these tests catch the drift before CI
 * deploys a broken API contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OnboardingStatusResponseSchema,
  UpdateTenantProfileResponseSchema,
  UpdateUserProfileResponseSchema,
  ONBOARDING_PROGRESS_DEFAULT,
} from '@metanoia/types';
import type { OnboardingProgress } from '@metanoia/types';
import * as withTenantTxModule from '../prisma/with-tenant-tx';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { OnboardingWizardService } from './onboarding-wizard.service';
import { requestContext } from '../common/context/request-context';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const USER_ID   = '01912345-6789-7000-8000-0000000000a1';

const SAMPLE_PROGRESS: OnboardingProgress = {
  currentStep: 3,
  completedSteps: [1, 2],
  stepData: { '1': { name: 'Pastor Roundtrip', roleTitle: 'Pastor' } },
  completed: false,
  completedAt: null,
  skippedAt: null,
};

const BASE_TENANT: Record<string, unknown> = {
  id: TENANT_ID,
  tenantId: TENANT_ID,
  name: 'Igreja Roundtrip',
  logoUrl: 'https://cdn.metanoia.app/tenants/logo.png',
  metadata: { denomination: 'Presbiteriana', city: 'Curitiba', state: 'PR' },
  onboardingProgress: SAMPLE_PROGRESS,
  focusIndicatorEnabled: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const BASE_USER: Record<string, unknown> = {
  id: USER_ID,
  email: 'roundtrip@test.local',
  name: 'Pastor Roundtrip',
  status: 'active',
  tenantId: TENANT_ID,
  profilePhotoUrl: 'https://cdn.metanoia.app/users/photo.jpg',
  roleTitle: 'Diácono',
  onboardingCompletedAt: null,
  isDemoData: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeTenantTx(tenantOverride = {}) {
  const tenant = { ...BASE_TENANT, ...tenantOverride };
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenant),
      update: vi.fn().mockResolvedValue(tenant),
    },
    group: { count: vi.fn().mockResolvedValue(2) },
  };
}

function makeUserTx(userOverride = {}) {
  const user = { ...BASE_USER, ...userOverride };
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue(user),
    },
  };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run({ tenantId: TENANT_ID, userId: USER_ID }, fn);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Onboarding Wizard — roundtrip anti-drift (Cenário 10)', () => {
  // Default mock targets tenant tx (sections B & C).
  // Section A overrides per-test with userTx.
  beforeEach(() => {
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, cb) => cb(makeTenantTx() as never),
    );
  });

  // ── A. PATCH /users/me — camelCase roundtrip ─────────────────────────────
  describe('A. PATCH /users/me — profile_photo_url ↔ profilePhotoUrl', () => {
    it('response parses via UpdateUserProfileResponseSchema without error', async () => {
      // Override: users section uses userTx (withTenantTx returns tx.user.update)
      vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
        async (_prisma, cb) => cb(makeUserTx() as never),
      );

      const service = new UsersService({} as never);

      const result = await withCtx(() =>
        service.updateProfile({
          profilePhotoUrl: 'https://cdn.metanoia.app/users/new-photo.jpg',
          roleTitle: 'Pastor Principal',
        }),
      );

      // Must parse without throwing (anti-drift: confirms camelCase mapping)
      expect(() => UpdateUserProfileResponseSchema.parse(result)).not.toThrow();
      const parsed = UpdateUserProfileResponseSchema.parse(result);

      // Explicit field checks (BASE_USER values returned by mock)
      expect(parsed.data.profilePhotoUrl).toBe('https://cdn.metanoia.app/users/photo.jpg');
      expect(parsed.data.roleTitle).toBe('Diácono');
    });

    it('profilePhotoUrl in response is never snake_case (anti-drift)', async () => {
      vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
        async (_prisma, cb) => cb(makeUserTx() as never),
      );

      const service = new UsersService({} as never);

      const result = await withCtx(() =>
        service.updateProfile({ name: 'Check Drift' }),
      );

      // profile_photo_url (snake) must NOT be present in response keys
      const keys = Object.keys((result as { data: Record<string, unknown> }).data);
      expect(keys).not.toContain('profile_photo_url');
      expect(keys).not.toContain('role_title');
      expect(keys).toContain('profilePhotoUrl');
      expect(keys).toContain('roleTitle');
    });
  });

  // ── B. PATCH /tenants/me — onboarding_progress JSONB roundtrip ───────────
  describe('B. PATCH /tenants/me — onboarding_progress ↔ onboardingProgress', () => {
    it('response parses via UpdateTenantProfileResponseSchema without error', async () => {
      const service = new TenantsService({} as never, { emit: vi.fn() } as never);

      const result = await withCtx(() =>
        service.updateProfile({ onboardingProgress: SAMPLE_PROGRESS }),
      );

      expect(() => UpdateTenantProfileResponseSchema.parse(result)).not.toThrow();
      const parsed = UpdateTenantProfileResponseSchema.parse(result);

      // onboardingProgress JSONB roundtrip — no data loss
      expect(parsed.data.onboardingProgress).not.toBeNull();
      const progress = parsed.data.onboardingProgress!;
      expect(progress.currentStep).toBe(SAMPLE_PROGRESS.currentStep);
      expect(progress.completedSteps).toEqual(SAMPLE_PROGRESS.completedSteps);
      expect(progress.completed).toBe(false);
      expect(progress.completedAt).toBeNull();
    });

    it('logoUrl in response is never snake_case (anti-drift)', async () => {
      const service = new TenantsService({} as never, { emit: vi.fn() } as never);

      const result = await withCtx(() =>
        service.updateProfile({ name: 'Check Logo Drift' }),
      );

      const keys = Object.keys((result as { data: Record<string, unknown> }).data);
      expect(keys).not.toContain('logo_url');
      expect(keys).not.toContain('onboarding_progress');
      expect(keys).toContain('logoUrl');
      expect(keys).toContain('onboardingProgress');
    });

    it('onboardingProgress JSONB roundtrip preserves stepData without loss', async () => {
      const progressWithStepData: OnboardingProgress = {
        ...SAMPLE_PROGRESS,
        stepData: {
          '1': { name: 'Pastor Full', roleTitle: 'Presbítero' },
          '2': { churchName: 'Igreja Plena', denomination: 'Batista', city: 'RJ', state: 'RJ' },
        },
      };

      const tenantWithStepData = {
        ...BASE_TENANT,
        onboardingProgress: progressWithStepData,
      };

      vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
        async (_prisma, cb) => cb(makeTenantTx(tenantWithStepData) as never),
      );

      const service = new TenantsService({} as never, { emit: vi.fn() } as never);

      const result = await withCtx(() =>
        service.updateProfile({ onboardingProgress: progressWithStepData }),
      );

      const parsed = UpdateTenantProfileResponseSchema.parse(result);
      const progress = parsed.data.onboardingProgress!;
      expect(progress.stepData['1']).toEqual({ name: 'Pastor Full', roleTitle: 'Presbítero' });
      expect(progress.stepData['2']).toEqual({
        churchName: 'Igreja Plena',
        denomination: 'Batista',
        city: 'RJ',
        state: 'RJ',
      });
    });
  });

  // ── C. GET /onboarding/status — OnboardingStatusResponseSchema ────────────
  describe('C. GET /onboarding/status — response shape matches contract', () => {
    it('response parses via OnboardingStatusResponseSchema without error', async () => {
      const prisma = {} as never; // withTenantTx mocked

      // OnboardingWizardService uses withTenantTx internally
      vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
        async (_prisma, cb) => cb(makeTenantTx() as never),
      );

      const service = new OnboardingWizardService(prisma);

      // OnboardingWizardService.getWizardStatus() already returns the full
      // envelope { data: { progress, hasRealGroups } } — not wrapped again by controller.
      const result = await withCtx(() => service.getWizardStatus());

      expect(() => OnboardingStatusResponseSchema.parse(result)).not.toThrow();

      const parsed = OnboardingStatusResponseSchema.parse(result);
      expect(parsed.data.progress).not.toBeNull();
      expect(typeof parsed.data.hasRealGroups).toBe('boolean');
    });

    it('hasRealGroups reflects group.count result (groupCount > 0 → true)', async () => {
      // group.count = 2 (from makeTenantTx default)
      vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
        async (_prisma, cb) => cb(makeTenantTx() as never),
      );

      const service = new OnboardingWizardService({} as never);
      const result = await withCtx(() => service.getWizardStatus());

      expect(result.data.hasRealGroups).toBe(true);
    });

    it('hasRealGroups is false when groupCount = 0', async () => {
      const txWithNoGroups = {
        ...makeTenantTx(),
        group: { count: vi.fn().mockResolvedValue(0) },
      };

      vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
        async (_prisma, cb) => cb(txWithNoGroups as never),
      );

      const service = new OnboardingWizardService({} as never);
      const result = await withCtx(() => service.getWizardStatus());

      expect(result.data.hasRealGroups).toBe(false);
    });

    it('GET /onboarding/status returns default progress when onboarding_progress is null', async () => {
      const txWithNull = makeTenantTx({ onboardingProgress: null });

      vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
        async (_prisma, cb) => cb(txWithNull as never),
      );

      const service = new OnboardingWizardService({} as never);
      const result = await withCtx(() => service.getWizardStatus());

      // Falls back to ONBOARDING_PROGRESS_DEFAULT
      expect(result.data.progress.currentStep).toBe(ONBOARDING_PROGRESS_DEFAULT.currentStep);
      expect(result.data.progress.completedSteps).toEqual(ONBOARDING_PROGRESS_DEFAULT.completedSteps);
      expect(result.data.progress.completed).toBe(false);
    });
  });
});
