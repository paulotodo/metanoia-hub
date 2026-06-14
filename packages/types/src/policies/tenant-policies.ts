import { z } from 'zod';

/**
 * TenantPoliciesSchema — the 5 behavioural toggles for a tenant.
 *
 * focusMonitoring → maps to tenant.focusIndicatorEnabled (NOT stored in JSONB).
 * mandatoryCamera, sequentialTrailAccess, autoPresenceTracking, expressMode →
 * stored in tenant_policies.policies JSONB.
 *
 * Tier requirements:
 *   - focusMonitoring       → 'pro'
 *   - mandatoryCamera       → 'pro'
 *   - sequentialTrailAccess → 'free'
 *   - autoPresenceTracking  → 'free'
 *   - expressMode           → 'free'
 */
export const TenantPoliciesSchema = z.object({
  focusMonitoring: z.boolean(),
  mandatoryCamera: z.boolean(),
  sequentialTrailAccess: z.boolean(),
  autoPresenceTracking: z.boolean(),
  expressMode: z.boolean(),
});

export type TenantPolicies = z.infer<typeof TenantPoliciesSchema>;

/** Partial DTO used for PATCH requests — all fields optional. */
export const UpdatePoliciesSchema = TenantPoliciesSchema.partial();

export type UpdatePoliciesDto = z.infer<typeof UpdatePoliciesSchema>;

/** Per-toggle tier information returned alongside policy values. */
export const TierInfoSchema = z.object({
  focusMonitoring: z.object({ requiresPlan: z.literal('pro') }),
  mandatoryCamera: z.object({ requiresPlan: z.literal('pro') }),
  sequentialTrailAccess: z.object({ requiresPlan: z.literal('free') }),
  autoPresenceTracking: z.object({ requiresPlan: z.literal('free') }),
  expressMode: z.object({ requiresPlan: z.literal('free') }),
});

export type TierInfo = z.infer<typeof TierInfoSchema>;

/** Full GET response envelope data shape. */
export const PoliciesResponseSchema = z.object({
  policies: TenantPoliciesSchema,
  policyVersion: z.number().int().positive(),
  tierInfo: TierInfoSchema,
});

export type PoliciesResponse = z.infer<typeof PoliciesResponseSchema>;
