import { z } from 'zod';

/**
 * Trend type for story 6-3 — re-exports as Zod schema
 * (the Prisma enum RadarTrend already exists; these schemas
 *  are for API contracts and frontend consumption).
 */
export const TrendTypeSchema = z.enum(['melhorando', 'estavel', 'declinio']);
export type TrendType = z.infer<typeof TrendTypeSchema>;

export const RadarStatusTypeSchema = z.enum(['verde', 'amarelo', 'vermelho']);
export type RadarStatusType = z.infer<typeof RadarStatusTypeSchema>;

/**
 * PastoralAlert with trend fields (Story 6-3 extensions).
 * Corresponds to PastoralAlert rows where previousStatus/newStatus are set.
 */
export const PastoralAlertWithTrendSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  groupId: z.string().uuid(),
  participantId: z.string().uuid(),
  previousStatus: RadarStatusTypeSchema.nullable(),
  newStatus: RadarStatusTypeSchema.nullable(),
  trend: TrendTypeSchema.nullable(),
  readAt: z.string().datetime().nullable(),
  dismissedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type PastoralAlertWithTrend = z.infer<typeof PastoralAlertWithTrendSchema>;

export const AlertListResponseSchema = z.object({
  data: z.array(PastoralAlertWithTrendSchema),
});
export type AlertListResponse = z.infer<typeof AlertListResponseSchema>;

/** Frozen map of all alert schema shapes for snapshot testing. */
export const ALERT_SCHEMA_SHAPES = {
  TrendTypeValues: TrendTypeSchema.options,
  RadarStatusTypeValues: RadarStatusTypeSchema.options,
} as const;

export type AlertSchemaShapes = typeof ALERT_SCHEMA_SHAPES;
