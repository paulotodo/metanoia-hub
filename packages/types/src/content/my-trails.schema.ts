import { z } from 'zod';

// ---------------------------------------------------------------------------
// MyTrailStatus — computed trail status for a participant
// ---------------------------------------------------------------------------

export const MyTrailStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);
export type MyTrailStatus = z.infer<typeof MyTrailStatusSchema>;

// ---------------------------------------------------------------------------
// MyTrailItem — single trail in participant's list
// ---------------------------------------------------------------------------

export const MyTrailItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  moduleCount: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative(),
  progressPercent: z.number().int().min(0).max(100),
  status: MyTrailStatusSchema,
  /** ISO 8601 — null when trail not started */
  lastActivity: z.string().datetime().nullable(),
});
export type MyTrailItem = z.infer<typeof MyTrailItemSchema>;

// ---------------------------------------------------------------------------
// Query — cursor-based pagination
// ---------------------------------------------------------------------------

export const MyTrailsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(10),
});
export type MyTrailsQuery = z.infer<typeof MyTrailsQuerySchema>;

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export const MyTrailsMetaSchema = z.object({
  nextCursor: z.string().uuid().nullable(),
  total: z.number().int().nonnegative(),
});
export type MyTrailsMeta = z.infer<typeof MyTrailsMetaSchema>;

export const MyTrailsResponseSchema = z.object({
  data: z.array(MyTrailItemSchema),
  meta: MyTrailsMetaSchema,
});
export type MyTrailsResponse = z.infer<typeof MyTrailsResponseSchema>;
