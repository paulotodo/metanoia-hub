import { z } from 'zod';
import { LessonStatusSchema } from './lesson-status.schema';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const LessonProgressEventTypeSchema = z.enum([
  'video_time_update',
  'scroll_position',
  'manual_mark',
  'open',
]);
export type LessonProgressEventType = z.infer<typeof LessonProgressEventTypeSchema>;

export const ReportProgressRequestSchema = z.object({
  progressPercent: z.number().int().min(0).max(100),
  eventType: LessonProgressEventTypeSchema,
});
export type ReportProgressRequest = z.infer<typeof ReportProgressRequestSchema>;

// ---------------------------------------------------------------------------
// BullMQ job payload
// ---------------------------------------------------------------------------

export const LessonProgressJobPayloadSchema = z.object({
  userId: z.string().uuid(),
  lessonId: z.string().uuid(),
  tenantId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
  eventType: LessonProgressEventTypeSchema,
});
export type LessonProgressJobPayload = z.infer<typeof LessonProgressJobPayloadSchema>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const LessonProgressSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  lessonId: z.string().uuid(),
  status: LessonStatusSchema,
  progressPercent: z.number().int().min(0).max(100),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  lastAccessedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LessonProgressData = z.infer<typeof LessonProgressSchema>;

export const ModuleProgressSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  moduleId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  completedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type ModuleProgressData = z.infer<typeof ModuleProgressSchema>;

export const TrailProgressSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  trailId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
  completedModules: z.number().int().nonnegative(),
  totalModules: z.number().int().nonnegative(),
  completedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type TrailProgressData = z.infer<typeof TrailProgressSchema>;

// ---------------------------------------------------------------------------
// "Continuar de onde parei" response
// ---------------------------------------------------------------------------

export const ResumeProgressResponseSchema = z.object({
  data: z.object({
    lessonId: z.string().uuid().nullable(),
    moduleId: z.string().uuid().nullable(),
    lastAccessedAt: z.string().datetime().nullable(),
  }),
});
export type ResumeProgressResponse = z.infer<typeof ResumeProgressResponseSchema>;

// ---------------------------------------------------------------------------
// Trail progress page response (aggregated view)
// ---------------------------------------------------------------------------

export const LessonStatusItemSchema = z.object({
  lessonId: z.string().uuid(),
  status: LessonStatusSchema,
  progressPercent: z.number().int().min(0).max(100),
  lastAccessedAt: z.string().datetime().nullable(),
});
export type LessonStatusItem = z.infer<typeof LessonStatusItemSchema>;

export const ModuleProgressDetailSchema = z.object({
  moduleId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  lessons: z.array(LessonStatusItemSchema),
});
export type ModuleProgressDetail = z.infer<typeof ModuleProgressDetailSchema>;

export const TrailProgressDetailSchema = z.object({
  trailId: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
  completedModules: z.number().int().nonnegative(),
  totalModules: z.number().int().nonnegative(),
  modules: z.array(ModuleProgressDetailSchema),
});
export type TrailProgressDetail = z.infer<typeof TrailProgressDetailSchema>;

export const TrailProgressDetailResponseSchema = z.object({
  data: TrailProgressDetailSchema,
});
export type TrailProgressDetailResponse = z.infer<typeof TrailProgressDetailResponseSchema>;

// Enqueue accepted response
export const ProgressAcceptedResponseSchema = z.object({
  data: z.object({ accepted: z.literal(true) }),
});
export type ProgressAcceptedResponse = z.infer<typeof ProgressAcceptedResponseSchema>;
