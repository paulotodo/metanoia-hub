import { z } from 'zod';
import { TrailStatusSchema } from './content-type.enum';
import { TrailAccessModeSchema } from './access-mode.enum';

export const CreateTrailRequestSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  status: TrailStatusSchema.optional().default('draft'),
  accessMode: TrailAccessModeSchema.optional().default('free'),
});
export type CreateTrailRequest = z.infer<typeof CreateTrailRequestSchema>;

export const UpdateTrailRequestSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: TrailStatusSchema.optional(),
  accessMode: TrailAccessModeSchema.optional(),
});
export type UpdateTrailRequest = z.infer<typeof UpdateTrailRequestSchema>;

export const TrailResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: TrailStatusSchema,
  accessMode: TrailAccessModeSchema,
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type TrailResponse = z.infer<typeof TrailResponseSchema>;

export const TrailsListMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type TrailsListMeta = z.infer<typeof TrailsListMetaSchema>;

export const TrailsListResponseSchema = z.object({
  data: z.array(TrailResponseSchema),
  meta: TrailsListMetaSchema,
});
export type TrailsListResponse = z.infer<typeof TrailsListResponseSchema>;

export const TrailsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  status: TrailStatusSchema.optional(),
});
export type TrailsListQuery = z.infer<typeof TrailsListQuerySchema>;
