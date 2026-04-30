import { z } from 'zod';

// ============================================================================
// Story 4-3 — Admin Tenant cria/lista/revoga convites para o seu tenant.
//
// API: /api/v1/admin/invites (admin_tenant)
//
// O fluxo de aceite (token side, /api/v1/invites/:token/...) já existe para
// 'pre_tenant_signup'. Este contrato cobre apenas o admin-side: criar
// convites de novo tipo que não criam tenant, mas que vinculam o user
// ao tenant atual ao serem aceitos.
// ============================================================================

export const AdminInviteKindSchema = z.enum([
  'tenant_member', // adiciona ao tenant como membro (sem grupo específico)
  'tenant_leader', // adiciona ao tenant como líder
  'group_member', // adiciona ao tenant + grupo específico como membro
  'group_leader', // adiciona ao tenant + grupo específico como líder
]);
export type AdminInviteKind = z.infer<typeof AdminInviteKindSchema>;

export const CreateAdminInviteInputSchema = z
  .object({
    inviteeEmail: z.string().email(),
    inviteeName: z.string().min(2).max(200),
    kind: AdminInviteKindSchema,
    groupId: z.string().uuid().optional(),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  })
  .refine(
    (v) =>
      (v.kind === 'group_member' || v.kind === 'group_leader')
        ? Boolean(v.groupId)
        : v.groupId === undefined,
    {
      message: 'group_id_required_for_group_kind',
      path: ['groupId'],
    },
  );
export type CreateAdminInviteInput = z.infer<
  typeof CreateAdminInviteInputSchema
>;

export const AdminInviteStatusSchema = z.enum([
  'pending',
  'accepted',
  'revoked',
  'expired',
]);
export type AdminInviteStatus = z.infer<typeof AdminInviteStatusSchema>;

export const AdminInviteSummarySchema = z.object({
  id: z.string().uuid(),
  inviteeEmail: z.string().email(),
  inviteeName: z.string().min(1),
  kind: AdminInviteKindSchema,
  groupId: z.string().uuid().nullable(),
  status: AdminInviteStatusSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type AdminInviteSummary = z.infer<typeof AdminInviteSummarySchema>;

export const AdminInviteCreateResponseSchema = z.object({
  data: z.object({
    invite: AdminInviteSummarySchema,
    inviteUrl: z.string().url(),
  }),
});
export type AdminInviteCreateResponse = z.infer<
  typeof AdminInviteCreateResponseSchema
>;

export const AdminInvitesListResponseSchema = z.object({
  data: z.array(AdminInviteSummarySchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
  }),
});
export type AdminInvitesListResponse = z.infer<
  typeof AdminInvitesListResponseSchema
>;
