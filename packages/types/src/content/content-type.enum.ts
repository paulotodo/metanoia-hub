import { z } from 'zod';

export const TrailStatusSchema = z.enum(['draft', 'published', 'archived']);
export type TrailStatus = z.infer<typeof TrailStatusSchema>;

export const LessonContentTypeSchema = z.enum([
  'video',
  'rich_text',
  'pdf_doc',
  'external_link',
]);
export type LessonContentType = z.infer<typeof LessonContentTypeSchema>;
