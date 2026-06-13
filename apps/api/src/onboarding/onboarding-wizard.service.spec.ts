/**
 * Unit tests for OnboardingWizardService.getWizardStatus — FASE 3 (Story 10-1).
 *
 * Covers:
 *   - Tenant without onboardingProgress → returns default (completed:false, skippedAt:null)
 *   - Tenant with persisted progress → returns real JSONB
 *   - hasRealGroups=true when tenant has groups
 *   - hasRealGroups=false when tenant has no groups
 *   - Response parseable by OnboardingStatusResponseSchema
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId, OnboardingStatusResponseSchema, ONBOARDING_PROGRESS_DEFAULT } from '@metanoia/types';
import * as withTenantTxModule from '../prisma/with-tenant-tx';
import { OnboardingWizardService } from './onboarding-wizard.service';
import { requestContext } from '../common/context/request-context';

const TENANT_ID = '01912345-6789-7000-8000-000000000001';

function makeTx(opts: { progress?: unknown; groupCount?: number } = {}) {
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(
        opts.progress !== undefined
          ? { onboardingProgress: opts.progress }
          : { onboardingProgress: null },
      ),
    },
    group: {
      count: vi.fn().mockResolvedValue(opts.groupCount ?? 0),
    },
  };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT_ID,
      userId: 'user-01',
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('OnboardingWizardService.getWizardStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default progress when onboardingProgress is null', async () => {
    const tx = makeTx({ progress: null });
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new OnboardingWizardService({} as never);
    const result = await withCtx(() => service.getWizardStatus());

    expect(result.data.progress).toEqual(ONBOARDING_PROGRESS_DEFAULT);
    expect(result.data.progress.completed).toBe(false);
    expect(result.data.progress.skippedAt).toBeNull();
    expect(result.data.progress.completedAt).toBeNull();
  });

  it('returns persisted progress when onboardingProgress is set', async () => {
    const savedProgress = {
      currentStep: 3,
      completedSteps: [1, 2],
      stepData: { mode: 'real-group' },
      completed: false,
      completedAt: null,
      skippedAt: null,
    };
    const tx = makeTx({ progress: savedProgress });
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new OnboardingWizardService({} as never);
    const result = await withCtx(() => service.getWizardStatus());

    expect(result.data.progress.currentStep).toBe(3);
    expect(result.data.progress.completedSteps).toEqual([1, 2]);
  });

  it('returns hasRealGroups=true when tenant has groups', async () => {
    const tx = makeTx({ groupCount: 3 });
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new OnboardingWizardService({} as never);
    const result = await withCtx(() => service.getWizardStatus());

    expect(result.data.hasRealGroups).toBe(true);
  });

  it('returns hasRealGroups=false when tenant has no groups', async () => {
    const tx = makeTx({ groupCount: 0 });
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new OnboardingWizardService({} as never);
    const result = await withCtx(() => service.getWizardStatus());

    expect(result.data.hasRealGroups).toBe(false);
  });

  it('response is parseable by OnboardingStatusResponseSchema', async () => {
    const tx = makeTx({ groupCount: 1 });
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new OnboardingWizardService({} as never);
    const result = await withCtx(() => service.getWizardStatus());

    const parsed = OnboardingStatusResponseSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('returns skippedAt=null for a new tenant', async () => {
    const tx = makeTx({ progress: null });
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(tx as unknown as Parameters<typeof fn>[0]),
    );

    const service = new OnboardingWizardService({} as never);
    const result = await withCtx(() => service.getWizardStatus());

    expect(result.data.progress.skippedAt).toBeNull();
    expect(result.data.progress.currentStep).toBe(1);
  });
});
