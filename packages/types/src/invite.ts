import { z } from 'zod';

// --- Invite status ---

export const InviteStatusSchema = z.enum(['valid', 'expired', 'used', 'invalid']);
export type InviteStatus = z.infer<typeof InviteStatusSchema>;

// --- GET /api/v1/invites/:token ---

export const InviteValidateLeaderSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});
export type InviteValidateLeader = z.infer<typeof InviteValidateLeaderSchema>;

export const InviteValidateTenantSchema = z.object({
  name: z.string(),
  id: z.string().uuid(),
});
export type InviteValidateTenant = z.infer<typeof InviteValidateTenantSchema>;

export const InviteValidateResponseSchema = z.object({
  status: InviteStatusSchema,
  leader: InviteValidateLeaderSchema.optional(),
  tenant: InviteValidateTenantSchema.nullable().optional(),
});
export type InviteValidateResponse = z.infer<typeof InviteValidateResponseSchema>;

// --- POST /api/v1/invites/:token/accept-terms ---

export const AcceptTermsRequestSchema = z.object({
  termsVersion: z.string().min(1),
});
export type AcceptTermsRequest = z.infer<typeof AcceptTermsRequestSchema>;

export const AcceptTermsResponseSchema = z.object({
  acceptedAt: z.string().datetime(),
});
export type AcceptTermsResponse = z.infer<typeof AcceptTermsResponseSchema>;

// --- POST /api/v1/invites/:token/create-account ---

export const CreateAccountRequestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  churchName: z.string().min(2).max(200),
});
export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>;

export const CreateAccountResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
});
export type CreateAccountResponse = z.infer<typeof CreateAccountResponseSchema>;
