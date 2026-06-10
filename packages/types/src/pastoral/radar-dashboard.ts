import { z } from 'zod';

// ---------------------------------------------------------------------------
// Radar Dashboard Aggregate — Story 6-6
// ---------------------------------------------------------------------------

/** Status distribution counts for the aggregate dashboard. */
export const RadarStatusDistributionSchema = z.object({
  verde: z.number().int().min(0),
  amarelo: z.number().int().min(0),
  vermelho: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type RadarStatusDistribution = z.infer<
  typeof RadarStatusDistributionSchema
>;

/** Per-group breakdown used in the aggregate dashboard. */
export const RadarGroupSummarySchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string(),
  verde: z.number().int().min(0),
  amarelo: z.number().int().min(0),
  vermelho: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type RadarGroupSummary = z.infer<typeof RadarGroupSummarySchema>;

/** Overall trend direction for the dashboard header. */
export const DashboardTrendSchema = z.enum(['melhora', 'estavel', 'piora']);
export type DashboardTrend = z.infer<typeof DashboardTrendSchema>;

/** Full response for GET /api/v1/radar/dashboard */
export const RadarDashboardResponseSchema = z.object({
  data: z.object({
    distribution: RadarStatusDistributionSchema,
    byGroup: z.array(RadarGroupSummarySchema),
    trend: DashboardTrendSchema,
    calculatedAt: z.string().datetime(),
  }),
  meta: z
    .object({
      groupCount: z.number().int().min(0),
      cachedAt: z.string().datetime().nullable(),
    })
    .optional(),
});
export type RadarDashboardResponse = z.infer<
  typeof RadarDashboardResponseSchema
>;
