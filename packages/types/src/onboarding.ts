import { z } from 'zod';

// Shape derived from apps/web/__mocks__/onboarding/onboarding.ts to keep FE parity.

// ---------------------------------------------------------------------------
// Wizard de Onboarding — Story 10-1
// ---------------------------------------------------------------------------

// MinIO URL allowlist — validated server-side too (dec-018 MUST).
// The allowlist is injected at runtime by the consumer (BE/FE) via
// `configureMinioAllowedHosts(hosts)`. Package-level default is empty
// (fail-closed: all URLs rejected) until configured.
// This design avoids Node `process.env` / DOM `URL` references in the
// shared package (tsconfig lib=["ES2022"] has neither).
let _minioAllowedHosts: string[] = [];

/** Configure the MinIO hostname allowlist at app startup (BE: MINIO_PUBLIC_HOST; FE: NEXT_PUBLIC_MINIO_HOST). */
export function configureMinioAllowedHosts(hosts: string[]): void {
  _minioAllowedHosts = hosts;
}

function _isMinioUrl(raw: string): boolean {
  if (!raw.startsWith('https://')) return false;
  if (_minioAllowedHosts.length === 0) return false;
  try {
    // Standard URL parsing is available in ES2022 target runtime environments
    // (Node ≥18, modern browsers). The tsconfig lib target only governs type
    // availability — the URL global is always present at runtime; we cast to
    // avoid the type error without pulling in DOM/node types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = new (globalThis as any).URL(raw) as { hostname: string };
    return _minioAllowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/** Zod schema for MinIO permanent HTTPS URLs (anti-XSS/SSRF, dec-018 MUST). */
export const MinioUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith('https://'), {
    message: 'URL deve usar https',
  })
  .refine(_isMinioUrl, {
    message: 'URL deve originar do bucket MinIO configurado',
  });

/** Shape of the onboarding_progress JSONB column (Tenant model). */
export const OnboardingProgressSchema = z
  .object({
    currentStep: z.number().int().min(1).max(5),
    completedSteps: z.array(z.number().int().min(1).max(5)),
    stepData: z.record(z.string(), z.unknown()),
    completed: z.boolean(),
    /** ISO 8601 — set when wizard is completed normally (FR-02). Mutually exclusive with skippedAt (FR-08). */
    completedAt: z.string().datetime().nullable(),
    /** ISO 8601 — set when wizard is explicitly skipped (FR-08). Mutually exclusive with completedAt. */
    skippedAt: z.string().datetime().nullable(),
  })
  .strict()
  .refine((d) => !(d.completedAt && d.skippedAt), {
    message: 'completedAt e skippedAt são mutuamente exclusivos (FR-08)',
  });

export type OnboardingProgress = z.infer<typeof OnboardingProgressSchema>;

/** Default value for tenants without onboarding_progress. */
export const ONBOARDING_PROGRESS_DEFAULT: OnboardingProgress = {
  currentStep: 1,
  completedSteps: [],
  stepData: {},
  completed: false,
  completedAt: null,
  skippedAt: null,
} as const;

/** Response envelope for GET /api/v1/onboarding/status */
export const OnboardingStatusResponseSchema = z.object({
  data: z.object({
    progress: OnboardingProgressSchema,
    /** True when the tenant has at least one real group (RLS-scoped, server-derived — never computed in FE). */
    hasRealGroups: z.boolean(),
  }),
});
export type OnboardingStatusResponse = z.infer<typeof OnboardingStatusResponseSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/v1/tenants/me — Update tenant profile + onboarding progress
// Anti-mass-assignment: .strict() + explicit allowlist (dec-018 MUST)
// ---------------------------------------------------------------------------

export const UpdateTenantProfileSchema = z
  .object({
    name: z.string().min(1),
    denomination: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    logoUrl: MinioUrlSchema.optional(),
    onboardingProgress: OnboardingProgressSchema.optional(),
  })
  .strict();

export type UpdateTenantProfile = z.infer<typeof UpdateTenantProfileSchema>;

export const UpdateTenantProfileResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    name: z.string(),
    denomination: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    logoUrl: z.string().nullable(),
    onboardingProgress: OnboardingProgressSchema.nullable(),
  }),
});
export type UpdateTenantProfileResponse = z.infer<typeof UpdateTenantProfileResponseSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/v1/users/me — Update user profile
// Anti-mass-assignment: .strict() + explicit allowlist (dec-018 MUST)
// Immutable fields (status, tenantId, email, onboardingCompletedAt) NOT included.
// ---------------------------------------------------------------------------

export const UpdateUserProfileSchema = z
  .object({
    name: z.string().min(1).optional(),
    profilePhotoUrl: MinioUrlSchema.optional(),
    roleTitle: z.string().optional(),
  })
  .strict();

export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;

export const UpdateUserProfileResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    name: z.string(),
    profilePhotoUrl: z.string().nullable(),
    roleTitle: z.string().nullable(),
  }),
});
export type UpdateUserProfileResponse = z.infer<typeof UpdateUserProfileResponseSchema>;

// --- Demo radar signal ---

export const DemoRadarSignalSchema = z.enum([
  'care-urgent',
  'care-attention',
  'care-ok',
]);
export type DemoRadarSignal = z.infer<typeof DemoRadarSignalSchema>;

// --- Demo radar participant ---

export const DemoRadarParticipantSchema = z.object({
  name: z.string(),
  signalType: DemoRadarSignalSchema,
  contextPhrase: z.string(),
});
export type DemoRadarParticipant = z.infer<typeof DemoRadarParticipantSchema>;

// --- GET /api/v1/onboarding/demo-radar ---

export const DemoRadarResponseSchema = z.object({
  tenantId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  isDemo: z.literal(true),
  groupName: z.string(),
  message: z.string(),
  participants: z.array(DemoRadarParticipantSchema),
  signals: z.array(DemoRadarSignalSchema),
});
export type DemoRadarResponse = z.infer<typeof DemoRadarResponseSchema>;

// --- PATCH /api/v1/users/me/onboarding-complete ---

export const OnboardingCompleteResponseSchema = z.object({
  userId: z.string().uuid(),
  onboardingCompletedAt: z.string().datetime(),
});
export type OnboardingCompleteResponse = z.infer<typeof OnboardingCompleteResponseSchema>;

// --- GET /api/v1/onboarding/demo-status ---

export const DemoStatusResponseSchema = z.object({
  hasDemoData: z.boolean(),
  hasRealData: z.boolean(),
  demoRecordCount: z.number().int().nonnegative(),
  nudgeDismissed: z.boolean(),
});
export type DemoStatusResponse = z.infer<typeof DemoStatusResponseSchema>;
