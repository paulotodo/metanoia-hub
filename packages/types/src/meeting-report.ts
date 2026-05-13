import { z } from 'zod';
import { PresenceTypeSchema, type PresenceType } from './presence';

/** Story 5.6 — minutes before meeting start at which the reminder fires. */
export const MEETING_REMINDER_MINUTES = 30;

export const MeetingReportAttendeeSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().nullable(),
  presenceType: PresenceTypeSchema,
  durationSeconds: z.number().int().nonnegative(),
  cameraSeconds: z.number().int().nonnegative(),
  focusScore: z.number().min(0).max(1).nullable(),
});
export type MeetingReportAttendee = z.infer<typeof MeetingReportAttendeeSchema>;

export const MeetingReportSummarySchema = z.object({
  attendees: z.array(MeetingReportAttendeeSchema),
  totalDurationMinutes: z.number().int().nonnegative(),
  /** Weighted engagement score across all attendees (0..1, null if no signals). */
  avgEngagementScore: z.number().min(0).max(1).nullable(),
  totalPresent: z.number().int().nonnegative(),
  totalPartial: z.number().int().nonnegative(),
  totalAbsent: z.number().int().nonnegative(),
});
export type MeetingReportSummary = z.infer<typeof MeetingReportSummarySchema>;

export const MeetingReportSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  meetingId: z.string().uuid(),
  summary: MeetingReportSummarySchema,
  generatedAt: z.string().datetime(),
});
export type MeetingReport = z.infer<typeof MeetingReportSchema>;

/** Restricted view returned to Participantes (only their own row). */
export const MeetingReportPersonalSchema = z.object({
  meetingId: z.string().uuid(),
  attendee: MeetingReportAttendeeSchema,
  generatedAt: z.string().datetime(),
});
export type MeetingReportPersonal = z.infer<typeof MeetingReportPersonalSchema>;

// --- Pure compute -----------------------------------------------------------

export interface ReportInputRow {
  userId: string;
  name?: string | null;
  presenceType: PresenceType;
  durationSeconds: number;
  cameraSeconds: number;
  focusScore: number | null;
}

export interface ReportComputeInput {
  rows: ReportInputRow[];
  meetingDurationSeconds: number;
}

/**
 * Story 5.6 — aggregates per-user attendance + telemetry rows into the
 * `MeetingReportSummary` shape. `avgEngagementScore` is a weighted blend:
 *
 *   per-row score = 0.5 * presenceFrac + 0.25 * cameraFrac + 0.25 * focusOrNeutral
 *
 *   - presenceFrac = durationSeconds / meetingDurationSeconds (clamped)
 *   - cameraFrac   = cameraSeconds / max(durationSeconds, 1) (clamped)
 *   - focusOrNeutral = focusScore when not null, else 0.5 (neutral)
 *
 * The avg is the mean of per-row scores. Returns null when there are no
 * rows or the meeting duration is zero.
 */
export function computeReportSummary(
  input: ReportComputeInput,
): MeetingReportSummary {
  const totalDurationMinutes = Math.round(input.meetingDurationSeconds / 60);
  const attendees: MeetingReportAttendee[] = input.rows.map((r) => ({
    userId: r.userId,
    name: r.name ?? null,
    presenceType: r.presenceType,
    durationSeconds: Math.max(0, Math.round(r.durationSeconds)),
    cameraSeconds: Math.max(0, Math.round(r.cameraSeconds)),
    focusScore: r.focusScore,
  }));

  let totalPresent = 0;
  let totalPartial = 0;
  let totalAbsent = 0;
  for (const a of attendees) {
    if (a.presenceType === 'integral') totalPresent += 1;
    else if (a.presenceType === 'parcial') totalPartial += 1;
    else totalAbsent += 1;
  }

  let avgEngagementScore: number | null = null;
  if (attendees.length > 0 && input.meetingDurationSeconds > 0) {
    let sum = 0;
    for (const a of attendees) {
      const presenceFrac = clamp01(
        a.durationSeconds / input.meetingDurationSeconds,
      );
      const cameraFrac = clamp01(
        a.cameraSeconds / Math.max(a.durationSeconds, 1),
      );
      const focusFrac = a.focusScore ?? 0.5;
      const rowScore =
        0.5 * presenceFrac + 0.25 * cameraFrac + 0.25 * clamp01(focusFrac);
      sum += rowScore;
    }
    avgEngagementScore = Math.round((sum / attendees.length) * 100) / 100;
  }

  return {
    attendees,
    totalDurationMinutes,
    avgEngagementScore,
    totalPresent,
    totalPartial,
    totalAbsent,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
