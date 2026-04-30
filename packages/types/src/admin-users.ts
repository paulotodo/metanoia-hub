import { z } from 'zod';

// ============================================================================
// Story 2-7 — Admin Tenant gerencia usuários e papéis dentro do seu tenant.
//
// API: /api/v1/admin/users (admin_tenant role only)
//
// Privacy: Admin Tenant vê apenas usuários do seu próprio tenant (RLS).
// Não cria usuários novos aqui — isso é via invite (Story 4-3). Esta API
// foca em listar membros e mudar/remover papéis.
// ============================================================================

export const TenantUserRoleSchema = z.enum([
  'admin_tenant',
  'editor_conteudo',
  'lider',
  'participante',
  'auditor',
]);
export type TenantUserRole = z.infer<typeof TenantUserRoleSchema>;

export const TenantUserSummarySchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: TenantUserRoleSchema,
  joinedAt: z.string().datetime(),
});
export type TenantUserSummary = z.infer<typeof TenantUserSummarySchema>;

export const TenantUsersListResponseSchema = z.object({
  data: z.array(TenantUserSummarySchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
  }),
});
export type TenantUsersListResponse = z.infer<
  typeof TenantUsersListResponseSchema
>;

export const UpdateTenantUserRoleInputSchema = z.object({
  role: TenantUserRoleSchema,
});
export type UpdateTenantUserRoleInput = z.infer<
  typeof UpdateTenantUserRoleInputSchema
>;

export const TenantUserDetailResponseSchema = z.object({
  data: TenantUserSummarySchema,
});
export type TenantUserDetailResponse = z.infer<
  typeof TenantUserDetailResponseSchema
>;
