import { z } from 'zod';

export const UserTenantRoleSchema = z.enum([
  'leader',
  'admin_tenant',
  'participant',
]);
export type UserTenantRole = z.infer<typeof UserTenantRoleSchema>;

export const UserTenantSchema = z.object({
  tenantId: z.string().uuid(),
  churchName: z.string().min(1).max(160),
  userRole: UserTenantRoleSchema,
  lastVisit: z.string().datetime().nullable(),
});
export type UserTenant = z.infer<typeof UserTenantSchema>;

export const MyTenantsResponseSchema = z.object({
  data: z.array(UserTenantSchema),
});
export type MyTenantsResponse = z.infer<typeof MyTenantsResponseSchema>;

export const SelectTenantInputSchema = z.object({
  tenantId: z.string().uuid(),
});
export type SelectTenantInput = z.infer<typeof SelectTenantInputSchema>;

export const SelectTenantResponseSchema = z.object({
  data: z.object({
    tenantId: z.string().uuid(),
  }),
});
export type SelectTenantResponse = z.infer<typeof SelectTenantResponseSchema>;
