import { z } from 'zod';

// ---------------------------------------------------------------------------
// GroupTrail — N:N join between groups and trails (Story 8-6)
// Endpoints (POST/DELETE/GET groups/:id/trails) added in Story 4-4.
// ---------------------------------------------------------------------------

export const GroupTrailResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  groupId: z.string().uuid(),
  trailId: z.string().uuid(),
  assignedBy: z.string().uuid(),
  assignedAt: z.string().datetime(),
});
export type GroupTrailResponse = z.infer<typeof GroupTrailResponseSchema>;

export const AssignTrailToGroupRequestSchema = z.object({
  trailId: z.string().uuid(),
  groupId: z.string().uuid(),
});
export type AssignTrailToGroupRequest = z.infer<typeof AssignTrailToGroupRequestSchema>;
