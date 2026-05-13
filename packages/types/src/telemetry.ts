import { z } from 'zod';

/**
 * Story 5.4 — engagement telemetry per (meeting, user).
 *
 * Three signals:
 * - `cameraOnSeconds` — accumulated time the user's video track was published
 * - `roomDurationSeconds` — total time in the room (join→leave, excluding
 *   reconnect gaps inside the FR48 tolerance window)
 * - `focusScore` — fraction (0..1) of time the meeting tab was visible per
 *   the frontend's Page Visibility API heartbeat. NULL when the tenant has
 *   `focusIndicatorEnabled=false` (NFR-L4 privacy default).
 */

export const FocusHeartbeatSchema = z.object({
  visible: z.boolean(),
  /** Client-side timestamp (ISO). Server uses receipt time as tie-breaker. */
  timestamp: z.string().datetime(),
});
export type FocusHeartbeat = z.infer<typeof FocusHeartbeatSchema>;

export const MeetingTelemetrySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  cameraOnSeconds: z.number().int().nonnegative(),
  roomDurationSeconds: z.number().int().nonnegative(),
  /** [0, 1] when computed; null when focus toggle is disabled. */
  focusScore: z.number().min(0).max(1).nullable(),
  createdAt: z.string().datetime(),
});
export type MeetingTelemetry = z.infer<typeof MeetingTelemetrySchema>;

// --- Pure compute ----------------------------------------------------------

export interface CameraSegment {
  /** Publish start (track_published). */
  start: string;
  /** Publish end (track_unpublished or meeting end). */
  end: string;
}

export interface TelemetryComputeInput {
  cameraSegments: CameraSegment[];
  roomDurationSeconds: number;
  focusVisibleSeconds: number | null;
  focusTotalSeconds: number | null;
}

export interface TelemetryComputeResult {
  cameraOnSeconds: number;
  roomDurationSeconds: number;
  focusScore: number | null;
}

/**
 * Story 5.4 — derive telemetry signals from raw inputs.
 *
 * - Camera: sum of segment durations (clamped ≥ 0).
 * - Focus score: visible/total, rounded to 2 decimals. Null when focus
 *   data is absent (toggle OFF, NFR-L4).
 * - Room duration is supplied by the caller (Story 5.3 attendance compute
 *   is the source of truth) and round-tripped for the persistence row.
 */
export function computeTelemetry(
  input: TelemetryComputeInput,
): TelemetryComputeResult {
  let cameraOnSeconds = 0;
  for (const seg of input.cameraSegments) {
    const startMs = new Date(seg.start).getTime();
    const endMs = new Date(seg.end).getTime();
    cameraOnSeconds += Math.max(0, (endMs - startMs) / 1000);
  }

  let focusScore: number | null = null;
  if (
    input.focusVisibleSeconds !== null &&
    input.focusTotalSeconds !== null &&
    input.focusTotalSeconds > 0
  ) {
    const raw = input.focusVisibleSeconds / input.focusTotalSeconds;
    focusScore = Math.min(1, Math.max(0, Math.round(raw * 100) / 100));
  }

  return {
    cameraOnSeconds: Math.round(cameraOnSeconds),
    roomDurationSeconds: Math.max(0, Math.round(input.roomDurationSeconds)),
    focusScore,
  };
}
