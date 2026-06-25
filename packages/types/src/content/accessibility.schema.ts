import { z } from 'zod';

export const LessonAccessibilityGapSchema = z.object({
  lessonId: z.string().uuid(),
  lessonName: z.string(),
  moduleName: z.string(),
  trailName: z.string(),
  tenantId: z.string().uuid(),
});
export type LessonAccessibilityGap = z.infer<typeof LessonAccessibilityGapSchema>;

export const AccessibilityGapsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type AccessibilityGapsQuery = z.infer<typeof AccessibilityGapsQuerySchema>;

export const AccessibilityGapsResponseSchema = z.object({
  data: z.array(LessonAccessibilityGapSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  }),
});
export type AccessibilityGapsResponse = z.infer<typeof AccessibilityGapsResponseSchema>;
