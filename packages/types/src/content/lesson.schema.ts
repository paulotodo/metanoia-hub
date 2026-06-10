import { z } from 'zod';
import { LessonContentTypeSchema } from './content-type.enum';

export const CreateLessonRequestSchema = z.object({
  name: z.string().min(2).max(255),
  contentType: LessonContentTypeSchema,
  contentUrl: z.string().url().max(2048).nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
});
export type CreateLessonRequest = z.infer<typeof CreateLessonRequestSchema>;

export const UpdateLessonRequestSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  contentType: LessonContentTypeSchema.optional(),
  contentUrl: z.string().url().max(2048).nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
});
export type UpdateLessonRequest = z.infer<typeof UpdateLessonRequestSchema>;

export const LessonResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  moduleId: z.string().uuid(),
  name: z.string(),
  contentType: LessonContentTypeSchema,
  contentUrl: z.string().nullable(),
  order: z.number().int().nonnegative(),
  estimatedDurationMinutes: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type LessonResponse = z.infer<typeof LessonResponseSchema>;

export const LessonsListResponseSchema = z.object({
  data: z.array(LessonResponseSchema),
  meta: z.object({ total: z.number().int().nonnegative() }),
});
export type LessonsListResponse = z.infer<typeof LessonsListResponseSchema>;

export const ReorderLessonsRequestSchema = z.object({
  lessonIds: z.array(z.string().uuid()).min(1),
});
export type ReorderLessonsRequest = z.infer<typeof ReorderLessonsRequestSchema>;
