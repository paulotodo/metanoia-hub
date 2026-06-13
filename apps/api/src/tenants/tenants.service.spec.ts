/**
 * Unit tests for TenantsService.updateProfile — FASE 3 (Story 10-1).
 *
 * Pattern: vi.spyOn(withTenantTxModule, 'withTenantTx') to bypass Prisma
 * $transaction without spinning up a real DB (same pattern as my-trails.service.spec.ts).
 *
 * Covers:
 *   - Updates typed columns (name, logoUrl) via Prisma
 *   - Updates metadata JSONB without overwriting unrelated metadata keys
 *   - Updates onboardingProgress without spread-merge
 *   - Rejects 400 in completedAt + skippedAt simultaneous (FR-08)
 *   - Emits step_completed when completedSteps grows
 *   - Emits wizard.completed when completed=true
 *   - Field immutability: strict Zod schema (tested in packages/types)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import * as withTenantTxModule from '../prisma/with-tenant-tx';
import { TenantsService } from './tenants.service';
import { requestContext } from '../common/context/request-context';

const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const USER_ID = '01912345-6789-7000-8000-0000000000a1';

const BASE_TENANT: Record<string, unknown> = {
  id: TENANT_ID,
  tenantId: TENANT_ID,
  name: 'Igreja Test',
  logoUrl: null,
  metadata: { denomination: 'Batista', city: 'Curitiba', state: 'PR', existingKey: 'keep-me' },
  onboardingProgress: null,
  focusIndicatorEnabled: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeEventEmitter() {
  return { emit: vi.fn() };
}

function makeTx(tenantOverride: Partial<typeof BASE_TENANT> = {}) {
  const tenant = { ...BASE_TENANT, ...tenantOverride };
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenant),
      update: vi.fn().mockResolvedValue(tenant),
    },
    group: {
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT_ID,
      userId: USER_ID,
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('TenantsService.updateProfile', () => {
  let eventEmitter: ReturnType<typeof makeEventEmitter>;

  beforeEach(() => {
    eventEmitter = makeEventEmitter();
  });

  // ─── Basic field updates ──────────────────────────────────────────────────

  it('updates name and logoUrl as typed columns', async () => {
    const tx = makeTx();
    tx.tenant.update.mockResolvedValue({
      ...BASE_TENANT,
      name: 'Nova Igreja',
      logoUrl: 'https://minio.test/tenants/01/logo.png',
    });

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    const result = await withCtx(() =>
      service.updateProfile({ name: 'Nova Igreja', logoUrl: 'https://minio.test/tenants/01/logo.png' }),
    );

    expect(tx.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Nova Igreja',
          logoUrl: 'https://minio.test/tenants/01/logo.png',
        }),
      }),
    );
    expect(result.data.name).toBe('Nova Igreja');
    expect(result.data.logoUrl).toBe('https://minio.test/tenants/01/logo.png');
  });

  it('updates denomination/city/state via explicit metadata merge without overwriting existing keys', async () => {
    const tx = makeTx();
    const updatedMetadata = { denomination: 'Presbiteriana', city: 'SP', state: 'SP', existingKey: 'keep-me' };
    tx.tenant.update.mockResolvedValue({ ...BASE_TENANT, metadata: updatedMetadata });

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    await withCtx(() =>
      service.updateProfile({ name: 'Igreja Test', denomination: 'Presbiteriana', city: 'SP', state: 'SP' }),
    );

    // metadata passed to update must include the new keys AND preserve existingKey
    const updateCall = tx.tenant.update.mock.calls[0][0] as { data: { metadata: Record<string, unknown> } };
    expect(updateCall.data.metadata['existingKey']).toBe('keep-me');
    expect(updateCall.data.metadata['denomination']).toBe('Presbiteriana');
  });

  it('updates onboardingProgress JSONB without spread-merge', async () => {
    const progress = {
      currentStep: 2,
      completedSteps: [1],
      stepData: {},
      completed: false,
      completedAt: null,
      skippedAt: null,
    };
    const tx = makeTx();
    tx.tenant.update.mockResolvedValue({ ...BASE_TENANT, onboardingProgress: progress });

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    const result = await withCtx(() =>
      service.updateProfile({ name: 'Igreja Test', onboardingProgress: progress }),
    );

    expect(result.data.onboardingProgress).toMatchObject({ currentStep: 2, completedSteps: [1] });
  });

  // ─── FR-08 — completedAt + skippedAt mutually exclusive ──────────────────

  it('rejects 400 when completedAt AND skippedAt are both set (FR-08)', async () => {
    const tx = makeTx();
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    await expect(
      withCtx(() =>
        service.updateProfile({
          name: 'Igreja Test',
          onboardingProgress: {
            currentStep: 1,
            completedSteps: [],
            stepData: {},
            completed: false,
            completedAt: '2026-01-01T00:00:00.000Z',
            skippedAt: '2026-01-01T01:00:00.000Z',
          },
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Domain events ────────────────────────────────────────────────────────

  it('emits step_completed when a new step is added to completedSteps', async () => {
    // Previous state: step 1 done; incoming: steps 1+2 done (step 2 is new)
    const prevProgress = {
      currentStep: 2,
      completedSteps: [1],
      stepData: {},
      completed: false,
      completedAt: null,
      skippedAt: null,
    };
    const tx = makeTx({ onboardingProgress: prevProgress });
    tx.tenant.update.mockResolvedValue({
      ...BASE_TENANT,
      onboardingProgress: { ...prevProgress, currentStep: 3, completedSteps: [1, 2] },
    });

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    await withCtx(() =>
      service.updateProfile({
        name: 'Igreja Test',
        onboardingProgress: {
          currentStep: 3,
          completedSteps: [1, 2],
          stepData: {},
          completed: false,
          completedAt: null,
          skippedAt: null,
        },
      }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'onboarding.wizard.step_completed',
      expect.objectContaining({
        eventType: 'onboarding.wizard.step_completed',
        tenantId: TENANT_ID,
        data: expect.objectContaining({ step: 2, stepName: 'community' }),
      }),
    );
  });

  it('emits wizard.completed when completed=true and previously false', async () => {
    const prevProgress = {
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      stepData: {},
      completed: false,
      completedAt: null,
      skippedAt: null,
    };
    const now = '2026-06-13T10:00:00.000Z';
    const tx = makeTx({ onboardingProgress: prevProgress });
    tx.tenant.update.mockResolvedValue({
      ...BASE_TENANT,
      onboardingProgress: { ...prevProgress, completed: true, completedAt: now },
    });

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    await withCtx(() =>
      service.updateProfile({
        name: 'Igreja Test',
        onboardingProgress: {
          currentStep: 5,
          completedSteps: [1, 2, 3, 4, 5],
          stepData: {},
          completed: true,
          completedAt: now,
          skippedAt: null,
        },
      }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'onboarding.wizard.completed',
      expect.objectContaining({
        eventType: 'onboarding.wizard.completed',
        tenantId: TENANT_ID,
      }),
    );
  });

  it('does NOT emit wizard.completed when already completed previously', async () => {
    const completedAt = '2026-06-01T00:00:00.000Z';
    const prevProgress = {
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      stepData: {},
      completed: true,
      completedAt,
      skippedAt: null,
    };
    const tx = makeTx({ onboardingProgress: prevProgress });
    tx.tenant.update.mockResolvedValue({ ...BASE_TENANT, onboardingProgress: prevProgress });

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    await withCtx(() =>
      service.updateProfile({
        name: 'Igreja Test',
        onboardingProgress: prevProgress,
      }),
    );

    const completedCalls = eventEmitter.emit.mock.calls.filter(
      (c) => c[0] === 'onboarding.wizard.completed',
    );
    expect(completedCalls).toHaveLength(0);
  });

  it('does not emit step_completed when completedSteps is unchanged', async () => {
    const prevProgress = {
      currentStep: 2,
      completedSteps: [1],
      stepData: {},
      completed: false,
      completedAt: null,
      skippedAt: null,
    };
    const tx = makeTx({ onboardingProgress: prevProgress });
    tx.tenant.update.mockResolvedValue({ ...BASE_TENANT, onboardingProgress: prevProgress });

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    await withCtx(() =>
      service.updateProfile({
        name: 'Igreja Test',
        onboardingProgress: prevProgress,
      }),
    );

    const stepCalls = eventEmitter.emit.mock.calls.filter(
      (c) => c[0] === 'onboarding.wizard.step_completed',
    );
    expect(stepCalls).toHaveLength(0);
  });

  // ─── logoUrl scheme security ──────────────────────────────────────────────
  // Note: Zod strict() validation at the pipe layer is the primary gate.
  // These cases verify that the service does NOT bypass the schema validation.
  // Full Zod schema rejection is tested in packages/types snapshot tests.

  it('returns null logoUrl when not provided in dto', async () => {
    const tx = makeTx({ logoUrl: null });
    tx.tenant.update.mockResolvedValue({ ...BASE_TENANT, logoUrl: null });

    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new TenantsService({} as never, eventEmitter as never);
    const result = await withCtx(() =>
      service.updateProfile({ name: 'Igreja Test' }),
    );

    expect(result.data.logoUrl).toBeNull();
  });
});
