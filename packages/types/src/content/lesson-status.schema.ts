import { z } from 'zod';

export const LessonStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;
