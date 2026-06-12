/**
 * User schemas — GET /api/v1/users/me (Story 9-2, AVS-02).
 *
 * AVS-02: useAuth() does not expose user.status — a dedicated TanStack Query
 * hook (useCurrentUser) must call this endpoint to get the current user
 * profile including status (needed for deletion_pending banner).
 */
import { z } from 'zod';

// ─── UserStatus ───────────────────────────────────────────────────────────────

export const UserStatusSchema = z.enum([
  'pending_verification',
  'active',
  'deletion_pending',
  'deleted',
]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

// ─── CurrentUser ─────────────────────────────────────────────────────────────

export const CurrentUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  status: UserStatusSchema,
});
export type CurrentUser = z.infer<typeof CurrentUserSchema>;

// ─── API envelope ─────────────────────────────────────────────────────────────

export const CurrentUserEnvelopeSchema = z.object({
  data: CurrentUserSchema,
});
export type CurrentUserEnvelope = z.infer<typeof CurrentUserEnvelopeSchema>;
