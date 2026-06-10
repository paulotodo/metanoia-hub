import { z } from 'zod';

// ---------------------------------------------------------------------------
// TrailVersion — immutable snapshot of a published trail (Story 8-6)
// ---------------------------------------------------------------------------

export const TrailVersionResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  trailId: z.string().uuid(),
  version: z.number().int().positive(),
  snapshotData: z.record(z.string(), z.unknown()),
  publishedAt: z.string().datetime(),
  publishedBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type TrailVersionResponse = z.infer<typeof TrailVersionResponseSchema>;

export const TrailVersionsListResponseSchema = z.object({
  data: z.array(TrailVersionResponseSchema),
  meta: z.object({ total: z.number().int().nonnegative() }),
});
export type TrailVersionsListResponse = z.infer<typeof TrailVersionsListResponseSchema>;
