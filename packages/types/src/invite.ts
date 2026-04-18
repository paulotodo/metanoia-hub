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

// ============================================================================
// /api/v1/invites/:token/resolve — discriminated union by `kind`
//
// Serves both 05.1 (Admin Tenant onboarding) and 06.2 (Participant joining a
// group). Backend queries both `invites` and `group_invites` tables and
// returns a `kind`-discriminated payload. Legacy `InviteValidateResponseSchema`
// above (plain `/api/v1/invites/:token`) remains for backward compat.
// ============================================================================

export const InviteKindSchema = z.enum(['admin-tenant', 'leader', 'participant']);
export type InviteKind = z.infer<typeof InviteKindSchema>;

// --- kind: 'admin-tenant' (onboarding pré-tenant — flow 05.1)

export const InviteResolveAdminTenantSchema = z.object({
  kind: z.literal('admin-tenant'),
  leader: InviteValidateLeaderSchema,
  tenant: InviteValidateTenantSchema.nullable(),
});
export type InviteResolveAdminTenant = z.infer<typeof InviteResolveAdminTenantSchema>;

// --- kind: 'participant' (convite de líder para Juliana — flow 06.2)

export const InviteResolveParticipantLeaderSchema = z.object({
  firstName: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
});
export type InviteResolveParticipantLeader = z.infer<
  typeof InviteResolveParticipantLeaderSchema
>;

export const InviteResolveParticipantGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});
export type InviteResolveParticipantGroup = z.infer<
  typeof InviteResolveParticipantGroupSchema
>;

export const InviteResolveParticipantSchema = z.object({
  kind: z.literal('participant'),
  leader: InviteResolveParticipantLeaderSchema,
  tenant: InviteValidateTenantSchema,
  group: InviteResolveParticipantGroupSchema,
});
export type InviteResolveParticipant = z.infer<
  typeof InviteResolveParticipantSchema
>;

// --- kind: 'leader' (reservado — líder convida líder, fora do escopo 06)

export const InviteResolveLeaderSchema = z.object({
  kind: z.literal('leader'),
  leader: z.object({
    firstName: z.string().min(1),
    email: z.string().email(),
  }),
  tenant: InviteValidateTenantSchema,
});
export type InviteResolveLeader = z.infer<typeof InviteResolveLeaderSchema>;

// --- Discriminated union (apenas quando status === 'valid')

export const InviteResolvePayloadSchema = z.discriminatedUnion('kind', [
  InviteResolveAdminTenantSchema,
  InviteResolveParticipantSchema,
  InviteResolveLeaderSchema,
]);
export type InviteResolvePayload = z.infer<typeof InviteResolvePayloadSchema>;

// --- Top-level response

export const InviteResolveResponseSchema = z.object({
  status: InviteStatusSchema,
  invite: InviteResolvePayloadSchema.nullable(),
});
export type InviteResolveResponse = z.infer<typeof InviteResolveResponseSchema>;

// --- POST /api/v1/invites/:token/accept (participant branch)

export const AcceptParticipantInviteResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tenantId: z.string().uuid(),
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type AcceptParticipantInviteResponse = z.infer<
  typeof AcceptParticipantInviteResponseSchema
>;
