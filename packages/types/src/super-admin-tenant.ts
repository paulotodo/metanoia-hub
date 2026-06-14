import { z } from 'zod';
import { PlanLimitsOverrideInputSchema } from './plans/subscription';

// ============================================================================
// Super Admin (Paulo) — tenant management contracts. Cenário 09.
//
// API surface (all routes guarded by @Roles('super_admin')):
//   GET    /api/v1/admin/super/tenants           — paginated list (09.2)
//   POST   /api/v1/admin/super/tenants           — provision (saga, 09.3)
//   GET    /api/v1/admin/super/tenants/:id       — detail (09.4)
//   PATCH  /api/v1/admin/super/tenants/:id       — edit name / status
//   POST   /api/v1/admin/super/tenants/:id/retry — retry failed provisioning
//   GET    /api/v1/admin/super/tenants/:id/provision-status — saga polling
//
// Privacy boundary (architectural, not visual):
//  - Super Admin sees TENANT envelope only — id, name, slug, plan, status,
//    aggregate counts.
//  - NEVER returns pastoral data (radar signals, care actions, reflections,
//    member names, presence). Aggregates are counts, never lists.
//
// Backed by PrismaAdminService (separate connection pool, no RLS).
// ============================================================================

// --- Enums

export const TenantStatusSchema = z.enum([
  'active',
  'suspended',
  'provisioning',
  'provisioning_failed',
]);
export type TenantStatus = z.infer<typeof TenantStatusSchema>;

export const TenantPlanSchema = z.enum(['free', 'pro', 'enterprise']);
export type TenantPlan = z.infer<typeof TenantPlanSchema>;

export const InviteDeliveryStatusSchema = z.enum([
  'pending',
  'sent',
  'accepted',
]);
export type InviteDeliveryStatus = z.infer<typeof InviteDeliveryStatusSchema>;

// --- 09.2 List

export const TenantSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  plan: TenantPlanSchema,
  status: TenantStatusSchema,
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type TenantSummary = z.infer<typeof TenantSummarySchema>;

export const TenantsListMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type TenantsListMeta = z.infer<typeof TenantsListMetaSchema>;

export const TenantsListResponseSchema = z.object({
  data: z.array(TenantSummarySchema),
  meta: TenantsListMetaSchema,
});
export type TenantsListResponse = z.infer<typeof TenantsListResponseSchema>;

export const TenantsListSortFieldSchema = z.enum([
  'name',
  'slug',
  'plan',
  'status',
  'memberCount',
  'createdAt',
]);
export type TenantsListSortField = z.infer<typeof TenantsListSortFieldSchema>;

export const TenantsListQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: TenantStatusSchema.optional(),
  plan: TenantPlanSchema.optional(),
  sortBy: TenantsListSortFieldSchema.default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type TenantsListQuery = z.infer<typeof TenantsListQuerySchema>;

// --- 09.4 Detail

export const TenantDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  plan: TenantPlanSchema,
  status: TenantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  adminEmail: z.string().email(),
  inviteStatus: InviteDeliveryStatusSchema,
  memberCount: z.number().int().nonnegative(),
  groupCount: z.number().int().nonnegative(),
  leaderCount: z.number().int().nonnegative(),
  // metadata: opaque JSONB bag — super_admin can read/write arbitrary key-value
  // pairs for operational notes (e.g. support tier, custom flags).
  // Returned as-is; never contains pastoral data.
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type TenantDetail = z.infer<typeof TenantDetailSchema>;

export const TenantDetailResponseSchema = z.object({
  data: TenantDetailSchema,
});
export type TenantDetailResponse = z.infer<typeof TenantDetailResponseSchema>;

// --- 09.3 Provision (POST)

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ProvisionTenantInputSchema = z.object({
  name: z.string().trim().min(3).max(100),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(SLUG_REGEX, 'invalid_slug_format'),
  adminEmail: z.string().email(),
  plan: TenantPlanSchema,
});
export type ProvisionTenantInput = z.infer<typeof ProvisionTenantInputSchema>;

export const ProvisionTenantDataSchema = z.object({
  tenantId: z.string().uuid(),
  status: TenantStatusSchema,
});
export const ProvisionTenantResponseSchema = z.object({
  data: ProvisionTenantDataSchema,
});
export type ProvisionTenantResponse = z.infer<
  typeof ProvisionTenantResponseSchema
>;

// --- 09.3 Saga polling (GET provision-status)

export const ProvisionSagaStepSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type ProvisionSagaStep = z.infer<typeof ProvisionSagaStepSchema>;

export const ProvisionSagaStatusSchema = z.enum([
  'running',
  'done',
  'failed',
]);
export type ProvisionSagaStatus = z.infer<typeof ProvisionSagaStatusSchema>;

export const ProvisionSagaStepReasonSchema = z.enum([
  'db',
  'keycloak',
  'invite',
]);
export type ProvisionSagaStepReason = z.infer<
  typeof ProvisionSagaStepReasonSchema
>;

export const ProvisionStatusDataSchema = z.object({
  step: ProvisionSagaStepSchema,
  status: ProvisionSagaStatusSchema,
  failedAt: ProvisionSagaStepReasonSchema.nullable(),
  error: z.string().nullable(),
});
export type ProvisionStatusData = z.infer<typeof ProvisionStatusDataSchema>;

export const ProvisionStatusResponseSchema = z.object({
  data: ProvisionStatusDataSchema,
});
export type ProvisionStatusResponse = z.infer<
  typeof ProvisionStatusResponseSchema
>;

// --- 09.4 PATCH (rename / change status)

export const TenantPatchInputSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    // metadata: opaque JSONB bag for operational notes; merged (not replaced)
    // server-side — send only the keys you want to update.
    metadata: z.record(z.string(), z.unknown()).optional(),
    // planLimitsOverride: JSONB per-tenant override. {} zeros out all overrides (US5 AC#3).
    // Positive integers only; validated by PlanLimitsOverrideInputSchema (Story 11-1).
    planLimitsOverride: PlanLimitsOverrideInputSchema.optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.status !== undefined ||
      v.metadata !== undefined ||
      v.planLimitsOverride !== undefined,
    { message: 'at_least_one_field_required' },
  );
export type TenantPatchInput = z.infer<typeof TenantPatchInputSchema>;

export const TenantPatchResponseSchema = z.object({
  data: TenantDetailSchema,
});
export type TenantPatchResponse = z.infer<typeof TenantPatchResponseSchema>;
