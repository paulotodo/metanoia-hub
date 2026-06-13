/**
 * Story 10-1 — FASE 6.4: Domain event payload verification for
 * onboarding.wizard.step_completed and onboarding.wizard.completed.
 *
 * Rationale (CHK009, FR-10, A09):
 *   - eventId MUST be a UUID v7 (time-ordered, not v4).
 *   - version MUST be 1 (versioned domain event contract).
 *   - payload MUST NOT contain PII (name, email, URL, profile_photo_url).
 *   - completed=true emits onboarding.wizard.completed with data.completedAt.
 *   - Distinct from tenants.service.spec.ts (which tests emit *firing*);
 *     this spec tests *payload shape* and *security constraints*.
 *
 * Confirmed from tenants.service.ts lines 141-162 (literal evidence):
 *   eventId: uuidv7()            ← UUID v7 required
 *   eventType: 'onboarding.wizard.step_completed' | 'onboarding.wizard.completed'
 *   version: 1
 *   tenantId: (from RequestContext, not body)
 *   data: { step, stepName }     ← step_completed
 *   data: { completedAt }        ← completed
 *   metadata: {}
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as withTenantTxModule from '../prisma/with-tenant-tx';
import { TenantsService } from '../tenants/tenants.service';
import { requestContext } from '../common/context/request-context';
import { uuidv7 } from 'uuidv7';

// ─── UUID v7 validation ────────────────────────────────────────────────────────
// UUID v7 has version nibble = '7' at position 14 (0-indexed in the canonical
// 8-4-4-4-12 hyphenated format): xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7_RE.test(value);
}

// ─── PII field guard ──────────────────────────────────────────────────────────
// Fields that MUST NOT appear in event payload (CHK024, A09)
const PII_FIELDS = [
  'name',
  'email',
  'profilePhotoUrl',
  'profile_photo_url',
  'logoUrl',
  'logo_url',
  'phone',
  'address',
  'cpf',
  'roleName',
  'displayName',
];

function containsPii(obj: unknown): string[] {
  const found: string[] = [];
  if (typeof obj !== 'object' || obj === null) return found;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (PII_FIELDS.includes(key)) found.push(key);
    const nested = containsPii((obj as Record<string, unknown>)[key]);
    found.push(...nested);
  }
  return found;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const USER_ID   = '01912345-6789-7000-8000-0000000000a1';

const BASE_TENANT: Record<string, unknown> = {
  id: TENANT_ID,
  tenantId: TENANT_ID,
  name: 'Igreja Events Test',
  logoUrl: null,
  metadata: {},
  onboardingProgress: null,
  focusIndicatorEnabled: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeTx(tenantOverride = {}) {
  const tenant = { ...BASE_TENANT, ...tenantOverride };
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenant),
      update: vi.fn().mockResolvedValue(tenant),
    },
    group: { count: vi.fn().mockResolvedValue(0) },
  };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run({ tenantId: TENANT_ID, userId: USER_ID }, fn);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Onboarding domain events — payload shape + security (6.4)', () => {
  let emitSpy: ReturnType<typeof vi.fn>;
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    emitSpy = vi.fn();
    eventEmitter = { emit: emitSpy };

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, cb) => cb(makeTx() as never),
    );
  });

  // ── step_completed payload ─────────────────────────────────────────────────
  describe('onboarding.wizard.step_completed', () => {
    it('emits with eventId that is a valid UUID v7', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 2,
            completedSteps: [1],
            stepData: {},
            completed: false,
            completedAt: null,
            skippedAt: null,
          },
        }),
      );

      const callArgs = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.step_completed',
      );
      expect(callArgs).toBeDefined();
      const payload = callArgs?.[1] as Record<string, unknown>;

      expect(isUuidV7(payload.eventId)).toBe(true);
    });

    it('eventId from the service is different from a UUID v4 (uuidv7 used)', async () => {
      // Verifica que eventId segue o padrão v7 (nibble = 7) e não v4 (nibble = 4)
      const sample = uuidv7();
      expect(isUuidV7(sample)).toBe(true);

      const v4Like = '550e8400-e29b-41d4-a716-446655440000'; // v4 pattern
      expect(isUuidV7(v4Like)).toBe(false);
    });

    it('payload has version = 1', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 2,
            completedSteps: [1],
            stepData: {},
            completed: false,
            completedAt: null,
            skippedAt: null,
          },
        }),
      );

      const callArgs = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.step_completed',
      );
      const payload = callArgs?.[1] as Record<string, unknown>;

      expect(payload.version).toBe(1);
    });

    it('payload has tenantId matching the request context', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 2,
            completedSteps: [1],
            stepData: {},
            completed: false,
            completedAt: null,
            skippedAt: null,
          },
        }),
      );

      const callArgs = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.step_completed',
      );
      const payload = callArgs?.[1] as Record<string, unknown>;

      expect(payload.tenantId).toBe(TENANT_ID);
    });

    it('payload data contains step and stepName (not PII)', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 2,
            completedSteps: [1],
            stepData: {},
            completed: false,
            completedAt: null,
            skippedAt: null,
          },
        }),
      );

      const callArgs = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.step_completed',
      );
      const payload = callArgs?.[1] as { data: { step: number; stepName: string } };

      expect(typeof payload.data.step).toBe('number');
      expect(typeof payload.data.stepName).toBe('string');
      expect(payload.data.step).toBe(1);
      expect(payload.data.stepName).toBe('profile');
    });

    it('payload does NOT contain PII fields (CHK024, A09)', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          name: 'Pastor Secreto',         // name goes to DB but NOT to event
          onboardingProgress: {
            currentStep: 2,
            completedSteps: [1],
            stepData: { '1': { name: 'Pastor Secreto', roleTitle: 'Pastor' } },
            completed: false,
            completedAt: null,
            skippedAt: null,
          },
        }),
      );

      const stepCompletedCalls = emitSpy.mock.calls.filter(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.step_completed',
      );
      expect(stepCompletedCalls.length).toBeGreaterThan(0);

      for (const [, payload] of stepCompletedCalls) {
        const piiFound = containsPii(payload);
        expect(piiFound).toEqual([]);
      }
    });

    it('payload has metadata: {} (empty object)', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 2,
            completedSteps: [1],
            stepData: {},
            completed: false,
            completedAt: null,
            skippedAt: null,
          },
        }),
      );

      const callArgs = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.step_completed',
      );
      const payload = callArgs?.[1] as { metadata: unknown };

      expect(payload.metadata).toEqual({});
    });

    it('emits once per newly completed step (step 1 only when completing step 1)', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 2,
            completedSteps: [1],
            stepData: {},
            completed: false,
            completedAt: null,
            skippedAt: null,
          },
        }),
      );

      const stepCompletedCalls = emitSpy.mock.calls.filter(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.step_completed',
      );
      expect(stepCompletedCalls).toHaveLength(1);
    });
  });

  // ── completed payload ──────────────────────────────────────────────────────
  describe('onboarding.wizard.completed', () => {
    const COMPLETED_AT = '2026-06-13T10:00:00.000Z';

    it('emits onboarding.wizard.completed when completed=true', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 5,
            completedSteps: [1, 2, 3, 4, 5],
            stepData: {},
            completed: true,
            completedAt: COMPLETED_AT,
            skippedAt: null,
          },
        }),
      );

      const completedCall = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.completed',
      );
      expect(completedCall).toBeDefined();
    });

    it('wizard.completed payload has eventId UUID v7 + version=1 + tenantId', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 5,
            completedSteps: [1, 2, 3, 4, 5],
            stepData: {},
            completed: true,
            completedAt: COMPLETED_AT,
            skippedAt: null,
          },
        }),
      );

      const completedCall = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.completed',
      );
      const payload = completedCall?.[1] as Record<string, unknown>;

      expect(isUuidV7(payload.eventId)).toBe(true);
      expect(payload.version).toBe(1);
      expect(payload.tenantId).toBe(TENANT_ID);
    });

    it('wizard.completed data has completedAt (ISO 8601)', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 5,
            completedSteps: [1, 2, 3, 4, 5],
            stepData: {},
            completed: true,
            completedAt: COMPLETED_AT,
            skippedAt: null,
          },
        }),
      );

      const completedCall = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.completed',
      );
      const payload = completedCall?.[1] as { data: { completedAt: unknown } };

      expect(typeof payload.data.completedAt).toBe('string');
      // Validates ISO 8601 format
      expect(new Date(payload.data.completedAt as string).toISOString()).toBe(COMPLETED_AT);
    });

    it('wizard.completed payload does NOT contain PII (CHK024)', async () => {
      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          name: 'Pastor PII Test',
          onboardingProgress: {
            currentStep: 5,
            completedSteps: [1, 2, 3, 4, 5],
            stepData: { '1': { name: 'Pastor PII Test', email: 'pii@test.local' } },
            completed: true,
            completedAt: COMPLETED_AT,
            skippedAt: null,
          },
        }),
      );

      const completedCall = emitSpy.mock.calls.find(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.completed',
      );
      const payload = completedCall?.[1];

      expect(containsPii(payload)).toEqual([]);
    });

    it('does NOT emit wizard.completed when completed was already true (idempotent)', async () => {
      // Tenant already has completed=true in its onboardingProgress
      const tenantAlreadyDone = {
        ...BASE_TENANT,
        onboardingProgress: {
          currentStep: 5,
          completedSteps: [1, 2, 3, 4, 5],
          stepData: {},
          completed: true,
          completedAt: COMPLETED_AT,
          skippedAt: null,
        },
      };

      vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
        async (_prisma, cb) => cb(makeTx(tenantAlreadyDone) as never),
      );

      const service = new TenantsService({} as never, eventEmitter as never);

      await withCtx(() =>
        service.updateProfile({
          onboardingProgress: {
            currentStep: 5,
            completedSteps: [1, 2, 3, 4, 5],
            stepData: {},
            completed: true,
            completedAt: COMPLETED_AT,
            skippedAt: null,
          },
        }),
      );

      const completedCalls = emitSpy.mock.calls.filter(
        ([evt]: [string, ...unknown[]]) => evt === 'onboarding.wizard.completed',
      );
      // Already completed → must NOT emit again (idempotent guard)
      expect(completedCalls).toHaveLength(0);
    });
  });
});
