import { z } from 'zod';

// ─── Period ──────────────────────────────────────────────────────────────────

export const LeaderSummaryPeriodSchema = z.enum(['7d', '30d', '90d', 'custom']);
export type LeaderSummaryPeriod = z.infer<typeof LeaderSummaryPeriodSchema>;

// ─── Query ────────────────────────────────────────────────────────────────────

export const LeaderSummaryQuerySchema = z
  .object({
    period: LeaderSummaryPeriodSchema,
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    groupId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      if (data.period === 'custom') {
        return data.startDate !== undefined && data.endDate !== undefined;
      }
      return true;
    },
    {
      message: "startDate and endDate are required when period is 'custom'",
      path: ['startDate'],
    },
  )
  .refine(
    (data) => {
      if (data.period === 'custom' && data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'startDate must be before endDate',
      path: ['startDate'],
    },
  );

export type LeaderSummaryQuery = z.infer<typeof LeaderSummaryQuerySchema>;

// ─── Per-group metrics ────────────────────────────────────────────────────────

export const LeaderGroupMetricsSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string(),
  avgAttendancePercent: z.number().nullable().default(null),
  avgTrailProgressPercent: z.number(),
  atRiskCount: z.number().int().nonnegative(),
  activeParticipantsCount: z.number().int().nonnegative(),
});

export type LeaderGroupMetrics = z.infer<typeof LeaderGroupMetricsSchema>;

// ─── Overall summary ──────────────────────────────────────────────────────────

export const LeaderSummaryOverallSchema = z.object({
  totalGroups: z.number().int(),
  totalParticipants: z.number().int(),
  overallAttendancePercent: z.number().nullable().default(null),
  overallTrailCompletionPercent: z.number(),
});

export type LeaderSummaryOverall = z.infer<typeof LeaderSummaryOverallSchema>;

// ─── Meta ─────────────────────────────────────────────────────────────────────

export const LeaderSummaryMetaSchema = z.object({
  period: LeaderSummaryPeriodSchema,
  startDate: z.string(),
  endDate: z.string(),
});

export type LeaderSummaryMeta = z.infer<typeof LeaderSummaryMetaSchema>;

// ─── Response ─────────────────────────────────────────────────────────────────

export const LeaderSummaryResponseSchema = z.object({
  data: z.object({
    groups: z.array(LeaderGroupMetricsSchema),
    summary: LeaderSummaryOverallSchema,
  }),
  meta: LeaderSummaryMetaSchema,
});

export type LeaderSummaryResponse = z.infer<typeof LeaderSummaryResponseSchema>;
