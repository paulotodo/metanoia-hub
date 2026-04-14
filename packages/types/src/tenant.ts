import { z } from 'zod';

// --- GET /api/v1/tenants/me ---

export const TenantMeResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
});
export type TenantMeResponse = z.infer<typeof TenantMeResponseSchema>;
