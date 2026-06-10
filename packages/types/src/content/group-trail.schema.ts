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

// Single-trail request (Story 8-6 compat)
export const AssignTrailToGroupRequestSchema = z.object({
  trailId: z.string().uuid(),
  groupId: z.string().uuid(),
});
export type AssignTrailToGroupRequest = z.infer<typeof AssignTrailToGroupRequestSchema>;

// ---------------------------------------------------------------------------
// Story 4-4 — bulk-associate API
// ---------------------------------------------------------------------------

/** POST /api/v1/groups/:groupId/trails — bulk assign */
export const AssociateTrailsRequestSchema = z.object({
  trailIds: z.array(z.string().uuid()).min(1, { message: 'trailIds must contain at least one UUID' }),
});
export type AssociateTrailsRequest = z.infer<typeof AssociateTrailsRequestSchema>;

/** 201 response body */
export const AssociateTrailsResponseSchema = z.object({
  data: z.array(GroupTrailResponseSchema),
  meta: z.object({ created: z.number() }),
});
export type AssociateTrailsResponse = z.infer<typeof AssociateTrailsResponseSchema>;

/** GET /api/v1/groups/:groupId/trails — list */
export const GroupTrailsListResponseSchema = z.object({
  data: z.array(GroupTrailResponseSchema),
  meta: z.object({ total: z.number() }),
});
export type GroupTrailsListResponse = z.infer<typeof GroupTrailsListResponseSchema>;

/** 422 body — invalid trail IDs */
export const InvalidTrailIdsResponseSchema = z.object({
  statusCode: z.literal(422),
  error: z.literal('Unprocessable Entity'),
  message: z.string(),
  invalidTrailIds: z.array(z.string().uuid()),
});
export type InvalidTrailIdsResponse = z.infer<typeof InvalidTrailIdsResponseSchema>;
