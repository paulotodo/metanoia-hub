import { z } from 'zod';

// ─── Constants ───────────────────────────────────────────────────────────────

export const REPORTS_QUEUE_NAME = 'reports';
export const REPORTS_JOB_TTL_SECONDS = 3600; // signed URL validity: 1h
export const REPORTS_LARGE_TRAIL_THRESHOLD = 1000; // participants above this → async 202
export const REPORTS_CSV_BOM = '﻿'; // UTF-8 BOM for Excel compatibility

// ─── Trail report filter query ────────────────────────────────────────────────

export const TrailReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  lastActivityAfter: z.string().datetime({ offset: true }).optional(),
  lastActivityBefore: z.string().datetime({ offset: true }).optional(),
});

export type TrailReportQuery = z.infer<typeof TrailReportQuerySchema>;

// ─── Trail report participant row ─────────────────────────────────────────────

export const TrailReportParticipantSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  progressPercent: z.number().int().min(0).max(100),
  completedModules: z.number().int().min(0),
  totalModules: z.number().int().min(0),
  completedLessons: z.number().int().min(0),
  totalLessons: z.number().int().min(0),
  lastActivityAt: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(['not_started', 'in_progress', 'completed']),
});

export type TrailReportParticipant = z.infer<typeof TrailReportParticipantSchema>;

// ─── Trail report meta ────────────────────────────────────────────────────────

export const TrailReportMetaSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  trailId: z.string().uuid(),
  trailName: z.string(),
  // Aggregated metrics over the full trail universe (AC #1), independent of view filters
  avgProgressPercent: z.number(),
  completedCount: z.number().int(),
  inProgressCount: z.number().int(),
  notStartedCount: z.number().int(),
});

export type TrailReportMeta = z.infer<typeof TrailReportMetaSchema>;

// ─── Trail report response ────────────────────────────────────────────────────

export const TrailReportResponseSchema = z.object({
  data: z.array(TrailReportParticipantSchema),
  meta: TrailReportMetaSchema,
});

export type TrailReportResponse = z.infer<typeof TrailReportResponseSchema>;

// ─── Trail summary (admin list) ───────────────────────────────────────────────

export const TrailSummarySchema = z.object({
  trailId: z.string().uuid(),
  trailName: z.string(),
  status: z.string(),
  totalParticipants: z.number().int(),
  avgProgressPercent: z.number(),
  completedCount: z.number().int(),
  inProgressCount: z.number().int(),
  notStartedCount: z.number().int(),
});

export type TrailSummary = z.infer<typeof TrailSummarySchema>;

export const TrailsSummaryResponseSchema = z.object({
  data: z.array(TrailSummarySchema),
  meta: z.object({
    total: z.number().int(),
  }),
});

export type TrailsSummaryResponse = z.infer<typeof TrailsSummaryResponseSchema>;

// ─── Export job ───────────────────────────────────────────────────────────────

export const ExportJobAcceptedSchema = z.object({
  data: z.object({
    jobId: z.string(),
    message: z.string(),
  }),
});

export type ExportJobAccepted = z.infer<typeof ExportJobAcceptedSchema>;

export const ExportJobStatusInnerSchema = z.object({
  jobId: z.string(),
  status: z.enum(['processing', 'completed', 'failed']),
  signedUrl: z.string().url().nullable(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  failureReason: z.string().nullable(),
});

export type ExportJobStatusInner = z.infer<typeof ExportJobStatusInnerSchema>;

// Envelope wrapper for GET /reports/jobs/:jobId → { data: ExportJobStatusInner }
export const ExportJobStatusSchema = z.object({
  data: ExportJobStatusInnerSchema,
});

export type ExportJobStatus = z.infer<typeof ExportJobStatusSchema>;

// ─── BullMQ job payload ───────────────────────────────────────────────────────

/**
 * Discriminated union for BullMQ export job payloads.
 *
 * - `kind: 'trail'`   — trail CSV export (existing, Story 5.7)
 * - `kind: 'meeting'` — meeting attendance CSV export (FR63, Story 13-1)
 *
 * CHK035: both kinds share the same `cache:reports:export-job:<tenantId>:<jobId>`
 * Redis key structure — covered by `getJobStatus` / `setJobStatus` in
 * ReportsService.
 */
export type ReportExportJobPayload =
  | {
      kind: 'trail';
      jobId: string;
      tenantId: string;
      trailId: string;
      trailName: string;
      requestedBy: string;
      /** User IDs to include (pre-filtered by role at enqueue time) */
      userIds: string[];
    }
  | {
      kind: 'meeting';
      jobId: string;
      tenantId: string;
      meetingId: string;
      /** User ID of the leader/admin who requested the export */
      requesterUserId: string;
      /** Whether requester has full view (leader/admin) — used for CSV column scope */
      canSeeFull: boolean;
    };

// ─── Leader summary (FR79, Story 13.2a) ──────────────────────────────────────
export {
  LeaderSummaryPeriodSchema,
  LeaderSummaryQuerySchema,
  LeaderGroupMetricsSchema,
  LeaderSummaryOverallSchema,
  LeaderSummaryMetaSchema,
  LeaderSummaryResponseSchema,
  type LeaderSummaryPeriod,
  type LeaderSummaryQuery,
  type LeaderGroupMetrics,
  type LeaderSummaryOverall,
  type LeaderSummaryMeta,
  type LeaderSummaryResponse,
} from './leader-summary';
export * from './tenant-summary';
