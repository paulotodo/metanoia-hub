import { z } from 'zod';

// --- Constants (Story 5.3) -------------------------------------------------

/**
 * Fraction of meeting duration above which presence is classified as
 * `integral`. AC3 fixes this at 80% — per-tenant overrides are deferred
 * to Epic 11 (plans & policies).
 */
export const PRESENCE_INTEGRAL_THRESHOLD = 0.8;

/**
 * Disconnection window (seconds) inside which a re-join is treated as the
 * same presence segment instead of a new one. FR48 — default 2 min.
 * Per-tenant configurability deferred to Epic 11.
 */
export const RECONNECTION_TOLERANCE_SECONDS = 120;

// --- Schemas ---------------------------------------------------------------

export const PresenceTypeSchema = z.enum(['integral', 'parcial', 'ausente']);
export type PresenceType = z.infer<typeof PresenceTypeSchema>;

export const PresenceSegmentSchema = z.object({
  joinedAt: z.string().datetime(),
  /** Null while participant is still connected at sampling time. */
  leftAt: z.string().datetime().nullable(),
});
export type PresenceSegment = z.infer<typeof PresenceSegmentSchema>;

export const MeetingAttendanceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  joinTime: z.string().datetime(),
  leaveTime: z.string().datetime(),
  totalDurationSeconds: z.number().int().nonnegative(),
  presenceType: PresenceTypeSchema,
  reconnections: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type MeetingAttendance = z.infer<typeof MeetingAttendanceSchema>;

export const MeetingSnapshotSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  meetingId: z.string().uuid(),
  snapshotData: z.unknown(),
  createdAt: z.string().datetime(),
});
export type MeetingSnapshot = z.infer<typeof MeetingSnapshotSchema>;

// --- Pure presence computation --------------------------------------------

export interface ComputeAttendanceInput {
  /** Ordered segments — earlier joinedAt first. */
  segments: PresenceSegment[];
  /** Meeting wall-clock duration in seconds. */
  meetingDurationSeconds: number;
  /** Override default tolerance window (seconds). */
  reconnectionToleranceSeconds?: number;
  /** Override integral threshold (fraction 0..1). */
  integralThreshold?: number;
}

export interface ComputeAttendanceResult {
  joinTime: string;
  leaveTime: string;
  totalDurationSeconds: number;
  presenceType: PresenceType;
  reconnections: number;
}

/**
 * Pure presence calculator (Story 5.3). Merges segments separated by less
 * than the tolerance window, sums durations, and classifies presence.
 *
 * - `integral` when totalDuration ≥ threshold × meetingDuration
 * - `parcial`  when totalDuration > 0 and below threshold
 * - `ausente`  when no segments / zero duration
 *
 * Reconnections are counted as merged segments minus one (i.e. how many
 * times the participant re-joined inside the tolerance window).
 */
export function computeAttendance(
  input: ComputeAttendanceInput,
): ComputeAttendanceResult | null {
  const sorted = [...input.segments]
    .filter((s) => s.joinedAt && (s.leftAt === null || s.leftAt))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

  if (sorted.length === 0) return null;

  const tolerance =
    input.reconnectionToleranceSeconds ?? RECONNECTION_TOLERANCE_SECONDS;
  const threshold = input.integralThreshold ?? PRESENCE_INTEGRAL_THRESHOLD;

  let totalSeconds = 0;
  let reconnections = 0;
  const first = sorted[0];
  // `sorted` was just checked for empty above; narrow for the type-checker.
  if (!first) return null;
  let segmentStart = new Date(first.joinedAt).getTime();
  let segmentEnd = first.leftAt
    ? new Date(first.leftAt).getTime()
    : segmentStart;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (!current) continue;
    const joinMs = new Date(current.joinedAt).getTime();
    const leaveMs = current.leftAt ? new Date(current.leftAt).getTime() : joinMs;
    const gapSeconds = (joinMs - segmentEnd) / 1000;

    if (gapSeconds <= tolerance) {
      // Same continuous presence — extend without penalty, count as reconnect.
      reconnections += 1;
      segmentEnd = Math.max(segmentEnd, leaveMs);
    } else {
      // Distinct segment — flush prior and start a new one.
      totalSeconds += Math.max(0, (segmentEnd - segmentStart) / 1000);
      segmentStart = joinMs;
      segmentEnd = leaveMs;
    }
  }
  totalSeconds += Math.max(0, (segmentEnd - segmentStart) / 1000);

  const earliestJoin = new Date(first.joinedAt).toISOString();
  const latestLeave = new Date(segmentEnd).toISOString();
  const rounded = Math.round(totalSeconds);

  let presenceType: PresenceType;
  if (rounded === 0) presenceType = 'ausente';
  else if (
    input.meetingDurationSeconds > 0 &&
    rounded >= threshold * input.meetingDurationSeconds
  )
    presenceType = 'integral';
  else presenceType = 'parcial';

  return {
    joinTime: earliestJoin,
    leaveTime: latestLeave,
    totalDurationSeconds: rounded,
    presenceType,
    reconnections,
  };
}
