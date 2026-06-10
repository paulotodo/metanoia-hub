import { z } from 'zod';

// ---------------------------------------------------------------------------
// Domain event: content.trail.progress_updated
// Emitted by the progress worker when trail-level progress changes.
// Consumer: Pastoral module (Epic 6) — planned as Story 6.9 (tech debt).
// ---------------------------------------------------------------------------

export const TrailProgressUpdatedDataSchema = z.object({
  userId: z.string().uuid(),
  trailId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
  previousPercent: z.number().int().min(0).max(100),
});
export type TrailProgressUpdatedData = z.infer<typeof TrailProgressUpdatedDataSchema>;

export const TrailProgressUpdatedMetadataSchema = z.object({
  correlationId: z.string(),
});
export type TrailProgressUpdatedMetadata = z.infer<typeof TrailProgressUpdatedMetadataSchema>;

export const TrailProgressUpdatedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('content.trail.progress_updated'),
  version: z.literal(1),
  tenantId: z.string().uuid(),
  timestamp: z.string().datetime(),
  data: TrailProgressUpdatedDataSchema,
  metadata: TrailProgressUpdatedMetadataSchema,
});
export type TrailProgressUpdatedEvent = z.infer<typeof TrailProgressUpdatedEventSchema>;

// Queue name for the trail-progress-updated domain events bus
export const LESSON_PROGRESS_QUEUE_NAME = 'lesson-progress';
export const TRAIL_PROGRESS_EVENTS_QUEUE_NAME = 'trail-progress-events';
