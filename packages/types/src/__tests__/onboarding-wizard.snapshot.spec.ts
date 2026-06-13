import { describe, it, expect } from 'vitest';
import {
  OnboardingProgressSchema,
  OnboardingStatusResponseSchema,
  UpdateTenantProfileSchema,
  UpdateUserProfileSchema,
  ONBOARDING_PROGRESS_DEFAULT,
} from '../onboarding';

// ---------------------------------------------------------------------------
// OnboardingProgressSchema
// ---------------------------------------------------------------------------

describe('OnboardingProgressSchema', () => {
  it('freezes schema shape', () => {
    expect(OnboardingProgressSchema.shape).toMatchSnapshot();
  });

  it('accepts valid progress (in-progress)', () => {
    const result = OnboardingProgressSchema.safeParse({
      currentStep: 3,
      completedSteps: [1, 2],
      stepData: { mode: 'real-group' },
      completed: false,
      completedAt: null,
      skippedAt: null,
    });
    expect({ success: result.success, data: result.success ? result.data : null }).toMatchSnapshot();
  });

  it('accepts valid progress (completed)', () => {
    const result = OnboardingProgressSchema.safeParse({
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      stepData: {},
      completed: true,
      completedAt: '2026-06-13T12:00:00.000Z',
      skippedAt: null,
    });
    expect({ success: result.success, data: result.success ? result.data : null }).toMatchSnapshot();
  });

  it('accepts valid progress (skipped)', () => {
    const result = OnboardingProgressSchema.safeParse({
      currentStep: 1,
      completedSteps: [],
      stepData: {},
      completed: false,
      completedAt: null,
      skippedAt: '2026-06-13T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects completedAt AND skippedAt simultaneously (FR-08)', () => {
    const result = OnboardingProgressSchema.safeParse({
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      stepData: {},
      completed: true,
      completedAt: '2026-06-13T12:00:00.000Z',
      skippedAt: '2026-06-13T11:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects step out of range', () => {
    const result = OnboardingProgressSchema.safeParse({
      currentStep: 6,
      completedSteps: [],
      stepData: {},
      completed: false,
      completedAt: null,
      skippedAt: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (.strict())', () => {
    const result = OnboardingProgressSchema.safeParse({
      currentStep: 1,
      completedSteps: [],
      stepData: {},
      completed: false,
      completedAt: null,
      skippedAt: null,
      hacked: true,
    });
    expect(result.success).toBe(false);
  });

  it('ONBOARDING_PROGRESS_DEFAULT is valid', () => {
    const result = OnboardingProgressSchema.safeParse(ONBOARDING_PROGRESS_DEFAULT);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OnboardingStatusResponseSchema
// ---------------------------------------------------------------------------

describe('OnboardingStatusResponseSchema', () => {
  it('freezes schema shape', () => {
    expect(OnboardingStatusResponseSchema.shape).toMatchSnapshot();
  });

  it('accepts valid status response', () => {
    const result = OnboardingStatusResponseSchema.safeParse({
      data: {
        progress: {
          currentStep: 1,
          completedSteps: [],
          stepData: {},
          completed: false,
          completedAt: null,
          skippedAt: null,
        },
        hasRealGroups: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid inner progress shape', () => {
    const result = OnboardingStatusResponseSchema.safeParse({
      data: {
        progress: { currentStep: 0 }, // step < 1, missing fields
        hasRealGroups: false,
      },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateTenantProfileSchema
// ---------------------------------------------------------------------------

describe('UpdateTenantProfileSchema', () => {
  it('freezes schema shape', () => {
    expect(UpdateTenantProfileSchema.shape).toMatchSnapshot();
  });

  it('accepts minimal valid body (name only)', () => {
    const result = UpdateTenantProfileSchema.safeParse({ name: 'Igreja Central' });
    expect(result.success).toBe(true);
  });

  it('accepts full valid body without logoUrl (no MinIO env in test)', () => {
    const result = UpdateTenantProfileSchema.safeParse({
      name: 'Igreja Central',
      denomination: 'Batista',
      city: 'Curitiba',
      state: 'PR',
      onboardingProgress: {
        currentStep: 2,
        completedSteps: [1],
        stepData: {},
        completed: false,
        completedAt: null,
        skippedAt: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = UpdateTenantProfileSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (.strict() anti-mass-assignment)', () => {
    const result = UpdateTenantProfileSchema.safeParse({ name: 'Igreja', hacked: true });
    expect(result.success).toBe(false);
  });

  it('rejects logoUrl with javascript: scheme (A04 XSS)', () => {
    const result = UpdateTenantProfileSchema.safeParse({
      name: 'Igreja',
      logoUrl: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });

  it('rejects logoUrl with http: scheme (not https)', () => {
    const result = UpdateTenantProfileSchema.safeParse({
      name: 'Igreja',
      logoUrl: 'http://minio.example.com/tenants/1/logo.png',
    });
    expect(result.success).toBe(false);
  });

  it('rejects completedAt + skippedAt simultaneously in onboardingProgress (FR-08)', () => {
    const result = UpdateTenantProfileSchema.safeParse({
      name: 'Igreja',
      onboardingProgress: {
        currentStep: 5,
        completedSteps: [1, 2, 3, 4, 5],
        stepData: {},
        completed: true,
        completedAt: '2026-06-13T12:00:00.000Z',
        skippedAt: '2026-06-13T11:00:00.000Z',
      },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateUserProfileSchema
// ---------------------------------------------------------------------------

describe('UpdateUserProfileSchema', () => {
  it('freezes schema shape', () => {
    expect(UpdateUserProfileSchema.shape).toMatchSnapshot();
  });

  it('accepts empty object (all fields optional)', () => {
    const result = UpdateUserProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid name + roleTitle', () => {
    const result = UpdateUserProfileSchema.safeParse({
      name: 'João Silva',
      roleTitle: 'Pastor Auxiliar',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name (min 1)', () => {
    const result = UpdateUserProfileSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (.strict() anti-mass-assignment)', () => {
    const result = UpdateUserProfileSchema.safeParse({ name: 'João', tenantId: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects immutable email field', () => {
    const result = UpdateUserProfileSchema.safeParse({ name: 'João', email: 'joao@example.com' });
    expect(result.success).toBe(false);
  });

  it('rejects immutable onboardingCompletedAt field', () => {
    const result = UpdateUserProfileSchema.safeParse({
      name: 'João',
      onboardingCompletedAt: '2026-06-13T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects profilePhotoUrl with http: scheme', () => {
    const result = UpdateUserProfileSchema.safeParse({
      profilePhotoUrl: 'http://minio.example.com/photos/me.jpg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects profilePhotoUrl with non-URL string', () => {
    const result = UpdateUserProfileSchema.safeParse({
      profilePhotoUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});
