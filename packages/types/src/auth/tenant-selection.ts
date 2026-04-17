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

export const MyTenantsDataSchema = z.array(UserTenantSchema);
export type MyTenantsData = z.infer<typeof MyTenantsDataSchema>;

export const MyTenantsResponseSchema = z.object({
  data: MyTenantsDataSchema,
});
export type MyTenantsResponse = z.infer<typeof MyTenantsResponseSchema>;

export const SelectTenantInputSchema = z.object({
  tenantId: z.string().uuid(),
});
export type SelectTenantInput = z.infer<typeof SelectTenantInputSchema>;

export const SelectTenantDataSchema = z.object({
  tenantId: z.string().uuid(),
});
export type SelectTenantData = z.infer<typeof SelectTenantDataSchema>;

export const SelectTenantResponseSchema = z.object({
  data: SelectTenantDataSchema,
});
export type SelectTenantResponse = z.infer<typeof SelectTenantResponseSchema>;
