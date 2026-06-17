import { z } from 'zod';
import { PresenceTypeSchema } from './presence';

// ─── FR63 — Leader view types (Story 13-1) ────────────────────────────────────

/**
 * Engagement level classification for FR-03:
 *   low    < 0.50
 *   medium ≥ 0.50 and < 0.75
 *   high   ≥ 0.75
 */
export const EngagementLevelSchema = z.enum(['low', 'medium', 'high']);
export type EngagementLevel = z.infer<typeof EngagementLevelSchema>;

/**
 * Per-participant row in the FR63 leader report.
 * Extends the Story 5.6 attendee with email, joinedAt/leftAt and engagement
 * fields.
 */
export const MeetingReportParticipantFR63Schema = z.object({
  userId: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  /** Presence status in PT-BR labels for display and CSV export. */
  status: PresenceTypeSchema,
  joinedAt: z.string().datetime({ offset: true }).nullable(),
  leftAt: z.string().datetime({ offset: true }).nullable(),
  durationSeconds: z.number().int().nonnegative(),
  /** Duration-ratio engagement score per FR-03: durationSeconds / meetingDurationSeconds (clamped 0..1) */
  engagementScore: z.number().min(0).max(1).nullable(),
  engagementLevel: EngagementLevelSchema.nullable(),
});
export type MeetingReportParticipantFR63 = z.infer<
  typeof MeetingReportParticipantFR63Schema
>;

/**
 * Aggregate metrics for the FR63 leader report.
 */
export const MeetingReportMetricsSchema = z.object({
  totalParticipants: z.number().int().nonnegative(),
  presentCount: z.number().int().nonnegative(),
  partialCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  /** Attendance rate = presentCount / totalParticipants (0..1) */
  attendanceRate: z.number().min(0).max(1),
  avgEngagementScore: z.number().min(0).max(1).nullable(),
  avgEngagementLevel: EngagementLevelSchema.nullable(),
});
export type MeetingReportMetrics = z.infer<typeof MeetingReportMetricsSchema>;

/**
 * Full response envelope for GET /api/v1/meetings/:id/report (leader/admin
 * view, FR63).
 */
export const MeetingLeaderReportResponseSchema = z.object({
  data: z.object({
    meetingId: z.string().uuid(),
    metrics: MeetingReportMetricsSchema,
    participants: z.array(MeetingReportParticipantFR63Schema),
    generatedAt: z.string().datetime(),
  }),
});
export type MeetingLeaderReportResponse = z.infer<
  typeof MeetingLeaderReportResponseSchema
>;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Classifies a per-participant engagement score into EngagementLevel.
 * Thresholds per FR-03 (spec FR63 + dec-006): high ≥ 0.75, medium ≥ 0.50, low < 0.50.
 */
export function classifyEngagementLevel(score: number): EngagementLevel {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Computes the per-participant FR-03 engagement score for the FR63 leader view.
 *   score = durationSeconds / meetingDurationSeconds  (clamped 0..1)
 *
 * This is a simple duration-ratio per spec FR63 + dec-006. The cameraSeconds
 * parameter is accepted for API compatibility but is NOT used in this calculation.
 * (The Story 5.6 avgEngagementScore composite blend is computed separately in
 * computeReportSummary and is unaffected by this function.)
 *
 * Returns null when meetingDurationSeconds <= 0.
 */
export function computeParticipantEngagement(
  durationSeconds: number,
  _cameraSeconds: number,
  meetingDurationSeconds: number,
): { score: number; level: EngagementLevel } | null {
  if (meetingDurationSeconds <= 0) return null;
  const clamp = (v: number) =>
    Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v));
  const score = Math.round(clamp(durationSeconds / meetingDurationSeconds) * 1000) / 1000;
  return { score, level: classifyEngagementLevel(score) };
}
