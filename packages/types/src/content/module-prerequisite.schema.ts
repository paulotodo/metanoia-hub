import { z } from 'zod';

/// SetPrerequisitesRequest — replaces the full prerequisite list for a module
export const SetPrerequisitesRequestSchema = z.object({
  prerequisiteModuleIds: z.array(z.string().uuid()).min(0),
});
export type SetPrerequisitesRequest = z.infer<typeof SetPrerequisitesRequestSchema>;

/// ModulePrerequisiteResponse — single prerequisite entry
export const ModulePrerequisiteResponseSchema = z.object({
  moduleId: z.string().uuid(),
  prerequisiteModuleId: z.string().uuid(),
});
export type ModulePrerequisiteResponse = z.infer<typeof ModulePrerequisiteResponseSchema>;

/// PrerequisitesListResponse — list of prerequisites for a module
export const PrerequisitesListResponseSchema = z.object({
  data: z.array(ModulePrerequisiteResponseSchema),
  meta: z.object({ total: z.number().int().nonnegative() }),
});
export type PrerequisitesListResponse = z.infer<typeof PrerequisitesListResponseSchema>;
