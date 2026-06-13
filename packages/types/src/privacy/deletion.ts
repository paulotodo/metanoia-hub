/**
 * Privacy Deletion — Zod schemas, types and constants for Story 9-2 (LGPD Art. 18 VI).
 *
 * Decisions embedded:
 *   dec-006: idempotent createJob (2x → same requestId)
 *   dec-007: rollback intra-tenant on failure; replay-safe (status guard)
 *   dec-009: leader guardrail — 422 LEADER_ACTIVE_GROUPS
 *   AVS-03: exponential backoff attempts:3, delay:60_000
 *   dec-012 (Q4): export blocked during deletion_pending → 409
 */
import { z } from 'zod';

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRIVACY_DELETION_QUEUE_NAME = 'privacy-deletion';
export const PRIVACY_DELETION_JOB_KEY_PREFIX = 'cache:privacy:deletion-job';
export const PRIVACY_DELETION_GRACE_DAYS = 7;
export const PRIVACY_DELETION_DEADLINE_DAYS = 30;

// ─── Request / Response Schemas ───────────────────────────────────────────────

/** POST /privacy/deletion body — requires user to type the literal 'EXCLUIR'. */
export const PrivacyDeletionRequestSchema = z.object({
  confirm: z.literal('EXCLUIR'),
});
export type PrivacyDeletionRequest = z.infer<typeof PrivacyDeletionRequestSchema>;

export const PrivacyDeletionResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.literal('pending'),
  cancellableUntil: z.string().datetime(),
  deletionDeadline: z.string().datetime(),
});
export type PrivacyDeletionResponse = z.infer<typeof PrivacyDeletionResponseSchema>;

// ─── Status Schema ────────────────────────────────────────────────────────────

export const DeletionStatusEnum = z.enum([
  'pending',
  'soft_deleted',
  'hard_deleted',
  'cancelled',
  'failed',
]);
export type DeletionStatus = z.infer<typeof DeletionStatusEnum>;

export const PrivacyDeletionStatusSchema = z.object({
  requestId: z.string().uuid(),
  status: DeletionStatusEnum,
  cancellableUntil: z.string().datetime(),
  deletionDeadline: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
});
export type PrivacyDeletionStatus = z.infer<typeof PrivacyDeletionStatusSchema>;

// ─── Leader Blocker Schema ────────────────────────────────────────────────────

export const LeaderBlockerGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const LeaderBlockerSchema = z.object({
  error: z.literal('LEADER_ACTIVE_GROUPS'),
  groups: z.array(LeaderBlockerGroupSchema),
});
export type LeaderBlocker = z.infer<typeof LeaderBlockerSchema>;

// ─── API Envelope Schemas (for frontend hooks) ────────────────────────────────

export const PrivacyDeletionResponseEnvelopeSchema = z.object({
  data: PrivacyDeletionResponseSchema,
});
export type PrivacyDeletionResponseEnvelope = z.infer<typeof PrivacyDeletionResponseEnvelopeSchema>;

export const PrivacyDeletionStatusEnvelopeSchema = z.object({
  data: PrivacyDeletionStatusSchema,
});
export type PrivacyDeletionStatusEnvelope = z.infer<typeof PrivacyDeletionStatusEnvelopeSchema>;

// ─── BullMQ Job Payload ───────────────────────────────────────────────────────

export interface PrivacyDeletionJobPayload {
  requestId: string;
  userId: string;
  allTenantIds: string[];
  requestedAt: string;
  cancellableUntil: string;
  deletionDeadline: string;
}
