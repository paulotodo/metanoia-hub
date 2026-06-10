import { z } from 'zod';

export const CreateModuleRequestSchema = z.object({
  name: z.string().min(2).max(255),
});
export type CreateModuleRequest = z.infer<typeof CreateModuleRequestSchema>;

export const UpdateModuleRequestSchema = z.object({
  name: z.string().min(2).max(255).optional(),
});
export type UpdateModuleRequest = z.infer<typeof UpdateModuleRequestSchema>;

export const ModuleResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  trailId: z.string().uuid(),
  name: z.string(),
  order: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ModuleResponse = z.infer<typeof ModuleResponseSchema>;

export const ModulesListResponseSchema = z.object({
  data: z.array(ModuleResponseSchema),
  meta: z.object({ total: z.number().int().nonnegative() }),
});
export type ModulesListResponse = z.infer<typeof ModulesListResponseSchema>;

export const ReorderModulesRequestSchema = z.object({
  moduleIds: z.array(z.string().uuid()).min(1),
});
export type ReorderModulesRequest = z.infer<typeof ReorderModulesRequestSchema>;
