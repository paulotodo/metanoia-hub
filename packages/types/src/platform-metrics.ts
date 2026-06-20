import { z } from 'zod';

// ============================================================================
// Platform Metrics — Super Admin (FR67 / Story 13.4)
//
// API surface (guarded by @Roles(Role.SUPER_ADMIN)):
//   GET /api/v1/admin/platform-metrics/summary — agregados globais (FR67-04)
//   GET /api/v1/admin/platform-metrics/tenants — lista paginada (FR67-05)
//
// Fonte: mv_platform_metrics (Materialized View — refresh via FlowProducer)
// ============================================================================

// --- Sort field whitelist (SEC-02: anti-injection)
export const PlatformMetricsTenantsSortFieldSchema = z.enum([
  'tenantName',
  'totalUsers',
  'activeUsers',
  'totalGroups',
  'meetingsHeld',
  'storageBytesUsed',
  'tenantCreatedAt',
]);
export type PlatformMetricsTenantsSortField = z.infer<typeof PlatformMetricsTenantsSortFieldSchema>;

// --- Query DTO para /tenants
export const PlatformTenantsQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  sortBy:    PlatformMetricsTenantsSortFieldSchema.default('tenantName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  plan:      z.string().optional(),
  status:    z.string().optional(),
});
export type PlatformTenantsQuery = z.infer<typeof PlatformTenantsQuerySchema>;

// --- Row individual de tenant nas métricas
export const PlatformMetricsTenantRowSchema = z.object({
  tenantId:         z.string().uuid(),
  tenantName:       z.string(),
  tenantPlan:       z.string(),
  tenantStatus:     z.string(),
  tenantCreatedAt:  z.string().datetime(),
  totalUsers:       z.number().int().nonnegative(),
  activeUsers:      z.number().int().nonnegative(),
  activeCurrentMonth: z.boolean(),
  activePrevMonth:  z.boolean(),
  totalGroups:      z.number().int().nonnegative(),
  meetingsHeld:     z.number().int().nonnegative(),
  storageBytesUsed: z.string(), // BigInt serializado como string
  refreshedAt:      z.string().datetime(),
});
export type PlatformMetricsTenantRow = z.infer<typeof PlatformMetricsTenantRowSchema>;

// --- Resposta /summary (FR67-04)
export const PlatformMetricsSummarySchema = z.object({
  totalTenants:    z.number().int().nonnegative(),
  totalUsers:      z.number().int().nonnegative(),
  activeUsers:     z.number().int().nonnegative(),
  totalGroups:     z.number().int().nonnegative(),
  meetingsHeld:    z.number().int().nonnegative(),
  storageBytesUsed: z.string(), // BigInt como string
  churnedTenants:  z.number().int().nonnegative(),
  newTenants:      z.number().int().nonnegative(),
  netGrowth:       z.number().int(), // pode ser negativo
});
export type PlatformMetricsSummary = z.infer<typeof PlatformMetricsSummarySchema>;

export const PlatformMetricsSummaryResponseSchema = z.object({
  data: PlatformMetricsSummarySchema,
  meta: z.object({
    generatedAt: z.string().datetime(),
    cacheTTL:    z.number().int().positive(),
  }),
});
export type PlatformMetricsSummaryResponse = z.infer<typeof PlatformMetricsSummaryResponseSchema>;

// --- Resposta /tenants (FR67-05)
export const PlatformMetricsTenantListMetaSchema = z.object({
  page:       z.number().int().positive(),
  limit:      z.number().int().positive(),
  total:      z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  sortBy:     PlatformMetricsTenantsSortFieldSchema,
  sortOrder:  z.enum(['asc', 'desc']),
});
export type PlatformMetricsTenantListMeta = z.infer<typeof PlatformMetricsTenantListMetaSchema>;

export const PlatformMetricsTenantListResponseSchema = z.object({
  data: z.array(PlatformMetricsTenantRowSchema),
  meta: PlatformMetricsTenantListMetaSchema,
});
export type PlatformMetricsTenantListResponse = z.infer<typeof PlatformMetricsTenantListResponseSchema>;
