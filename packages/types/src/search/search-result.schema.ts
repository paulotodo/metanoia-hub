import { z } from 'zod';
import { LessonContentTypeSchema } from '../content/content-type.enum';

/**
 * A single search result item — a lesson matching the full-text query.
 * snippet uses sentinel chars \x02/\x03 (NOT HTML tags) — FE highlights via JSX.
 */
export const searchResultItemSchema = z.object({
  lessonId: z.string().uuid(),
  lessonName: z.string(),
  moduleId: z.string().uuid(),
  moduleName: z.string(),
  trailId: z.string().uuid(),
  trailName: z.string(),
  contentType: LessonContentTypeSchema,
  /** Highlighted excerpt — sentinels \x02 (start) and \x03 (end). Never HTML. */
  snippet: z.string(),
  /** ts_rank score for sorting relevance */
  rank: z.number(),
  /** true when the parent trail is in draft status */
  isDraft: z.boolean(),
});

export type SearchResultItem = z.infer<typeof searchResultItemSchema>;

/**
 * Paginated search response envelope.
 * data is capped at 20 items (enforced in service layer).
 */
export const searchResponseSchema = z.object({
  data: z.array(searchResultItemSchema).max(20),
  meta: z.object({
    total: z.number().int().nonnegative(),
    query: z.string(),
  }),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

/** Query params schema for GET /api/v1/search */
export const searchQuerySchema = z.object({
  q: z.string().min(1).trim(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
