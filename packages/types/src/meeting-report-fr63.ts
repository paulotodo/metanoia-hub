import { z } from 'zod';
import { PresenceTypeSchema } from './presence';

// ─── FR63 — Leader view types (Story 13-1) ────────────────────────────────────

/**
 * Engagement level classification for FR-03:
 *   low    < 0.4
 *   medium ≥ 0.4 and ≤ 0.75
 *   high   > 0.75
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
  /** Weighted engagement score per FR-03: 0.7*presenceFrac + 0.3*cameraFrac */
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
 * Thresholds per FR-03: low < 0.4, medium [0.4, 0.75], high > 0.75.
 */
export function classifyEngagementLevel(score: number): EngagementLevel {
  if (score > 0.75) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

/**
 * Computes the per-participant FR-03 engagement score:
 *   score = 0.7 * presenceFrac + 0.3 * cameraFrac
 *
 * presenceFrac = durationSeconds / meetingDurationSeconds (clamped 0..1)
 * cameraFrac   = cameraSeconds / max(durationSeconds, 1) (clamped 0..1)
 *
 * Returns null when meetingDurationSeconds = 0.
 */
export function computeParticipantEngagement(
  durationSeconds: number,
  cameraSeconds: number,
  meetingDurationSeconds: number,
): { score: number; level: EngagementLevel } | null {
  if (meetingDurationSeconds <= 0) return null;
  const clamp = (v: number) =>
    Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v));
  const presenceFrac = clamp(durationSeconds / meetingDurationSeconds);
  const cameraFrac = clamp(cameraSeconds / Math.max(durationSeconds, 1));
  const score = Math.round((0.7 * presenceFrac + 0.3 * cameraFrac) * 1000) / 1000;
  return { score, level: classifyEngagementLevel(score) };
}
