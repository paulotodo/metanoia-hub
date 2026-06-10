import { z } from 'zod';

// ---------------------------------------------------------------------------
// Video interval tracking
// ---------------------------------------------------------------------------

/** A continuous segment of video watched by the participant */
export const VideoIntervalSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});
export type VideoInterval = z.infer<typeof VideoIntervalSchema>;

/** Payload sent from FE hook to BullMQ for video progress tracking */
export const VideoProgressPayloadSchema = z.object({
  /** Merged unique watched intervals (non-overlapping, start < end) */
  watchedIntervals: z.array(VideoIntervalSchema),
  /** Total video duration in seconds */
  totalDurationSeconds: z.number().positive(),
  /** Floor percentage of unique watched time (0–100) */
  uniqueWatchedPercent: z.number().int().min(0).max(100),
});
export type VideoProgressPayload = z.infer<typeof VideoProgressPayloadSchema>;

// ---------------------------------------------------------------------------
// Manual completion
// ---------------------------------------------------------------------------

export const CompletedBySchema = z.enum(['participant', 'leader']);
export type CompletedBy = z.infer<typeof CompletedBySchema>;

export const ManualCompletionRequestSchema = z.object({
  completedBy: CompletedBySchema,
});
export type ManualCompletionRequest = z.infer<typeof ManualCompletionRequestSchema>;
