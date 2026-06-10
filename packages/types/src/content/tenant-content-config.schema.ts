import { z } from 'zod';

// ---------------------------------------------------------------------------
// TenantContentConfig — per-tenant completion rule overrides
// Convention over configuration: absent config uses defaults (video=90, doc=80)
// ---------------------------------------------------------------------------

export const TenantContentConfigSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  videoThresholdPercent: z.number().int().min(50).max(100),
  docScrollThresholdPercent: z.number().int().min(50).max(100),
  allowManualVideoCompletion: z.boolean(),
  allowManualDocCompletion: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TenantContentConfig = z.infer<typeof TenantContentConfigSchema>;

/** GET /api/v1/tenant-config/content response */
export const TenantContentConfigResponseSchema = z.object({
  data: TenantContentConfigSchema,
});
export type TenantContentConfigResponse = z.infer<typeof TenantContentConfigResponseSchema>;

/** PATCH /api/v1/tenant-config/content request — all fields optional */
export const UpdateTenantContentConfigSchema = z.object({
  videoThresholdPercent: z.number().int().min(50).max(100).optional(),
  docScrollThresholdPercent: z.number().int().min(50).max(100).optional(),
  allowManualVideoCompletion: z.boolean().optional(),
  allowManualDocCompletion: z.boolean().optional(),
});
export type UpdateTenantContentConfigRequest = z.infer<typeof UpdateTenantContentConfigSchema>;
