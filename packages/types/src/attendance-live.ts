import { z } from 'zod';

/**
 * Story 5.5 — real-time presence snapshot served by the
 * `/api/v1/meetings/:id/attendance/live` SSE endpoint.
 *
 * On initial connect (and on every reconnect) the server emits a `snapshot`
 * event with the full current state; subsequent webhook events are
 * forwarded as discriminated `delta` events.
 */

export const LiveParticipantStatusSchema = z.enum(['na-sala', 'saiu']);
export type LiveParticipantStatus = z.infer<typeof LiveParticipantStatusSchema>;

export const LiveParticipantSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  status: LiveParticipantStatusSchema,
  /** Seconds since first join — accumulates across reconnections. */
  currentDurationSeconds: z.number().int().nonnegative(),
  cameraOn: z.boolean(),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().nullable(),
});
export type LiveParticipant = z.infer<typeof LiveParticipantSchema>;

export const AttendanceLiveSnapshotSchema = z.object({
  type: z.literal('snapshot'),
  meetingId: z.string().uuid(),
  capturedAt: z.string().datetime(),
  participants: z.array(LiveParticipantSchema),
});
export type AttendanceLiveSnapshot = z.infer<typeof AttendanceLiveSnapshotSchema>;

export const AttendanceLiveDeltaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('participant.joined'),
    meetingId: z.string().uuid(),
    userId: z.string(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal('participant.left'),
    meetingId: z.string().uuid(),
    userId: z.string(),
    timestamp: z.string().datetime(),
  }),
]);
export type AttendanceLiveDelta = z.infer<typeof AttendanceLiveDeltaSchema>;

export const AttendanceLiveEventSchema = z.union([
  AttendanceLiveSnapshotSchema,
  AttendanceLiveDeltaSchema,
]);
export type AttendanceLiveEvent = z.infer<typeof AttendanceLiveEventSchema>;
