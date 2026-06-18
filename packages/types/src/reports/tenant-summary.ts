import { z } from 'zod';

// ── Período ──────────────────────────────────────────────────────────────────────────────
export const TenantSummaryPeriodSchema = z.enum(["7d", "30d", "90d", "custom"]);
export type TenantSummaryPeriod = z.infer<typeof TenantSummaryPeriodSchema>;

// ── Query params ───────────────────────────────────────────────────────────────────────────
export const TenantSummaryQuerySchema = z
  .object({
    period: TenantSummaryPeriodSchema.default("30d"),
    startDate: z.string().datetime({ offset: true }).nullable().default(null),
    endDate: z.string().datetime({ offset: true }).nullable().default(null),
    groupId: z.string().uuid().nullable().default(null),
    status: z.enum(["verde", "amarelo", "vermelho"]).nullable().default(null),
  })
  .refine(
    (d) => d.period !== "custom" || (d.startDate !== null && d.endDate !== null),
    { message: "startDate e endDate são obrigatórios quando period=custom", path: ["startDate"] },
  )
  .refine(
    (d) => {
      if (d.period !== "custom" || d.startDate === null || d.endDate === null) return true;
      return new Date(d.startDate) < new Date(d.endDate);
    },
    { message: "startDate deve ser anterior a endDate", path: ["startDate"] },
  )
  .refine(
    (d) => {
      if (d.period !== "custom" || d.startDate === null || d.endDate === null) return true;
      const diffMs = new Date(d.endDate).getTime() - new Date(d.startDate).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= 365;
    },
    {
      message: "O intervalo de datas não pode exceder 365 dias (AC-SEC-06)",
      path: ["endDate"],
    },
  );

export type TenantSummaryQuery = z.infer<typeof TenantSummaryQuerySchema>;

// ── Semáforo ─────────────────────────────────────────────────────────────────────────────────
export const SemaforoSchema = z.enum(["verde", "amarelo", "vermelho"]);
export type Semaforo = z.infer<typeof SemaforoSchema>;

// ── Métricas por grupo ────────────────────────────────────────────────────────────────────────
export const TenantGroupMetricsSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string(),
  leaderName: z.string().nullable().default(null),
  attendanceAvgPercent: z.number().nullable().default(null),
  trailProgressAvgPercent: z.number().nullable().default(null),
  riskCount: z.number().int().nonnegative(),
  activeParticipants: z.number().int().nonnegative(),
  semaforo: SemaforoSchema,
});

export type TenantGroupMetrics = z.infer<typeof TenantGroupMetricsSchema>;

// ── Totais consolidados ─────────────────────────────────────────────────────────────────────────────
export const TenantSummaryOverallSchema = z.object({
  totalGroups: z.number().int().nonnegative(),
  totalLeaders: z.number().int().nonnegative(),
  totalParticipants: z.number().int().nonnegative(),
  overallAttendancePercent: z.number().nullable().default(null),
  overallTrailProgressPercent: z.number().nullable().default(null),
  totalRiskCount: z.number().int().nonnegative(),
});

export type TenantSummaryOverall = z.infer<typeof TenantSummaryOverallSchema>;

// ── Meta ──────────────────────────────────────────────────────────────────────────────────────
export const TenantSummaryMetaSchema = z.object({
  period: TenantSummaryPeriodSchema,
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default(null),
  lastRefreshAt: z.string().nullable().default(null),
  stale: z.boolean(),
  fromMaterializedView: z.boolean(),
});

export type TenantSummaryMeta = z.infer<typeof TenantSummaryMetaSchema>;

// ── Response GET /reports/tenant-summary ────────────────────────────────────────────────────────
export const TenantSummaryResponseSchema = z.object({
  data: z.object({
    groups: z.array(TenantGroupMetricsSchema),
    summary: TenantSummaryOverallSchema,
  }),
  meta: TenantSummaryMetaSchema,
});

export type TenantSummaryResponse = z.infer<typeof TenantSummaryResponseSchema>;

// ── Response POST /reports/tenant-summary/refresh (202 / 429) ────────────────────────────
export const TenantRefreshResponseSchema = z.object({
  data: z.object({
    accepted: z.boolean(),
    jobId: z.string().nullable().default(null),
  }),
  meta: z.object({
    retryAfter: z.number().nullable().default(null),
  }),
});

export type TenantRefreshResponse = z.infer<typeof TenantRefreshResponseSchema>;
