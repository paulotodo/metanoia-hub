import { z } from 'zod';

// --- GET /api/v1/tenants/me ---

export const TenantMeResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  /** Story 5-5/5-4 — when true, transparency banner mentions focus tracking
   * and the frontend may send Page Visibility heartbeats (default false). */
  focusIndicatorEnabled: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type TenantMeResponse = z.infer<typeof TenantMeResponseSchema>;
