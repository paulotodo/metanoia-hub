import { z } from 'zod';

// ─── PlanLimitsSchema ─────────────────────────────────────────────────────────

/**
 * Shape of the `limits` JSONB column in `subscription_plans` and the
 * resolved limits returned by PlanLimitsService.getLimits().
 *
 * null = ilimitado / inherit-from-default (enterprise tier stores nulls;
 * getLimits maps null → Infinity at runtime — C3).
 */
export const PlanLimitsSchema = z.object({
  maxGroups: z.number().positive().nullable(),
  maxMembersPerGroup: z.number().positive().nullable(),
  maxLeadersPerTenant: z.number().positive().nullable(),
});

export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

// ─── PlanLimitsOverrideSchema ─────────────────────────────────────────────────

/**
 * Shape of `tenants.plan_limits_override` JSONB (read/persist).
 * Partial — only overridden fields are present. `{}` means no override.
 */
export const PlanLimitsOverrideSchema = PlanLimitsSchema.partial();

export type PlanLimitsOverride = z.infer<typeof PlanLimitsOverrideSchema>;

// ─── PlanLimitsOverrideInputSchema ────────────────────────────────────────────

/**
 * Validation schema for the PATCH body when editing a tenant's override.
 * Fields must be strictly positive integers; rejects negatives with PT-BR message.
 * `{}` is valid and means "zero out all overrides" (US5 AC#3).
 */
export const PlanLimitsOverrideInputSchema = z.object({
  maxGroups: z
    .number()
    .int()
    .positive({ message: 'maxGroups deve ser um número inteiro positivo' })
    .optional(),
  maxMembersPerGroup: z
    .number()
    .int()
    .positive({ message: 'maxMembersPerGroup deve ser um número inteiro positivo' })
    .optional(),
  maxLeadersPerTenant: z
    .number()
    .int()
    .positive({ message: 'maxLeadersPerTenant deve ser um número inteiro positivo' })
    .optional(),
});

export type PlanLimitsOverrideInput = z.infer<typeof PlanLimitsOverrideInputSchema>;

// ─── SubscriptionPlanSchema ───────────────────────────────────────────────────

/**
 * Full representation of a SubscriptionPlan row (global table, no tenant_id).
 * `tenantCount` is computed at query time and optional (present in list responses).
 *
 * tier mirrors TenantPlanSchema — defined inline to avoid circular imports
 * (index.ts re-exports both files).
 */
export const SubscriptionPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  tier: z.enum(['free', 'pro', 'enterprise'] as const),
  limits: PlanLimitsSchema,
  features: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Only present in list-plans responses */
  tenantCount: z.number().int().nonnegative().optional(),
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

// ─── PatchSubscriptionPlanInputSchema ─────────────────────────────────────────

/**
 * Body schema for PATCH /api/v1/admin/super/plans/:planId
 */
export const PatchSubscriptionPlanInputSchema = z.object({
  limits: PlanLimitsSchema.partial().optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export type PatchSubscriptionPlanInput = z.infer<typeof PatchSubscriptionPlanInputSchema>;
