import { z } from 'zod';

// ============================================================================
// Story 4-2 — vincular membros e líderes a grupo.
//
// API: /api/v1/groups/:groupId/members (admin_tenant)
//
// Roles: 'lider' | 'membro'. Promoting to 'lider' is gated by the tenant's
// PlanLimits (leadersPerTenant). Capping members per group is enforced
// inline by the service since membersPerGroup is per-group.
// ============================================================================

export const GroupMemberRoleSchema = z.enum(['lider', 'membro']);
export type GroupMemberRole = z.infer<typeof GroupMemberRoleSchema>;

export const AddGroupMemberInputSchema = z.object({
  userId: z.string().uuid(),
  role: GroupMemberRoleSchema.default('membro'),
});
export type AddGroupMemberInput = z.infer<typeof AddGroupMemberInputSchema>;

export const UpdateGroupMemberRoleInputSchema = z.object({
  role: GroupMemberRoleSchema,
});
export type UpdateGroupMemberRoleInput = z.infer<
  typeof UpdateGroupMemberRoleInputSchema
>;

export const GroupMemberSummarySchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: GroupMemberRoleSchema,
  joinedAt: z.string().datetime(),
});
export type GroupMemberSummary = z.infer<typeof GroupMemberSummarySchema>;

export const GroupMembersListResponseSchema = z.object({
  data: z.array(GroupMemberSummarySchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    leaderCount: z.number().int().nonnegative(),
  }),
});
export type GroupMembersListResponse = z.infer<
  typeof GroupMembersListResponseSchema
>;

export const GroupMemberDetailResponseSchema = z.object({
  data: GroupMemberSummarySchema,
});
export type GroupMemberDetailResponse = z.infer<
  typeof GroupMemberDetailResponseSchema
>;
