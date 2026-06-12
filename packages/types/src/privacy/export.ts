/**
 * Privacy Export — Zod schemas, types and constants for Story 9-1 (LGPD data portability).
 *
 * Decisions embedded:
 *   dec-019 (CHK018): MinIO prefix = `exports/global/`
 *   dec-020 (CHK021): BullMQ backoff exponential — delays 1m / 5m / 30m
 *   CL-02: UserProfileExport excludes tenantId (internal metadata)
 *   CL-04 / dec-021: PastoralAction excluded from export scope
 */
import { z } from 'zod';

// ─── Constants ───────────────────────────────────────────────────────────────

export const PRIVACY_EXPORT_QUEUE_NAME = 'queue:privacy-export';
export const PRIVACY_EXPORT_JOB_KEY_PREFIX = 'cache:privacy:export-job';
export const PRIVACY_EXPORT_JOB_TTL_SECONDS = 172800; // 48h
export const PRIVACY_EXPORT_SIGNED_URL_SECONDS = 172800; // 48h
export const PRIVACY_EXPORT_ESTIMATED_HOURS = 24;

// ─── Request / Response Schemas ──────────────────────────────────────────────

export const PrivacyExportRequestSchema = z.object({
  format: z.enum(['json', 'pdf']),
});
export type PrivacyExportRequest = z.infer<typeof PrivacyExportRequestSchema>;

export const PrivacyExportJobResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal('accepted'),
  estimatedCompletionHours: z.number().int().positive(),
});
export type PrivacyExportJobResponse = z.infer<typeof PrivacyExportJobResponseSchema>;

export const PrivacyExportStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['accepted', 'processing', 'completed', 'failed']),
  signedUrl: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
});
export type PrivacyExportStatus = z.infer<typeof PrivacyExportStatusSchema>;

// ─── API Envelope Schemas (for frontend hooks) ────────────────────────────────

/** Envelope wrapper for POST /api/v1/privacy/export → 202 response. */
export const PrivacyExportJobEnvelopeSchema = z.object({
  data: PrivacyExportJobResponseSchema,
});
export type PrivacyExportJobEnvelope = z.infer<typeof PrivacyExportJobEnvelopeSchema>;

/** Envelope wrapper for GET /api/v1/privacy/export/:jobId response. */
export const PrivacyExportStatusEnvelopeSchema = z.object({
  data: PrivacyExportStatusSchema,
});
export type PrivacyExportStatusEnvelope = z.infer<typeof PrivacyExportStatusEnvelopeSchema>;

// ─── BullMQ Job Payload ───────────────────────────────────────────────────────

export interface PrivacyExportJobPayload {
  jobId: string;
  userId: string;
  format: 'json' | 'pdf';
  allTenantIds: string[];
  requestedAt: string;
}

// ─── Module-level Export Data Schemas ────────────────────────────────────────

/** User profile — excludes tenantId (CL-02 / dec-019). */
export const UserProfileExportSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  status: z.string(),
  onboardingCompletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserProfileExport = z.infer<typeof UserProfileExportSchema>;

export const UserExportDataSchema = z.object({
  profile: UserProfileExportSchema.nullable(),
  tenants: z.array(
    z.object({
      tenantId: z.string().uuid(),
      role: z.string(),
      joinedAt: z.string().datetime(),
    }),
  ),
});
export type UserExportData = z.infer<typeof UserExportDataSchema>;

export const GroupsExportDataSchema = z.object({
  memberships: z.array(
    z.object({
      groupId: z.string().uuid(),
      groupName: z.string(),
      role: z.string(),
      joinedAt: z.string().datetime(),
    }),
  ),
});
export type GroupsExportData = z.infer<typeof GroupsExportDataSchema>;

export const MeetingsExportDataSchema = z.object({
  attendance: z.array(
    z.object({
      meetingId: z.string().uuid(),
      title: z.string(),
      presenceType: z.string(),
      joinTime: z.string().datetime().nullable(),
      leaveTime: z.string().datetime().nullable(),
    }),
  ),
  participantRecords: z.array(
    z.object({
      id: z.string().uuid(),
      meetingId: z.string().uuid(),
      duration: z.number().nullable(),
      joinedAt: z.string().datetime().nullable(),
      leftAt: z.string().datetime().nullable(),
    }),
  ),
});
export type MeetingsExportData = z.infer<typeof MeetingsExportDataSchema>;

export const TrailsExportDataSchema = z.object({
  trailProgress: z.array(
    z.object({
      trailId: z.string().uuid(),
      trailName: z.string(),
      progressPercent: z.number(),
      completedAt: z.string().datetime().nullable(),
      updatedAt: z.string().datetime(),
    }),
  ),
  lessonProgress: z.array(
    z.object({
      lessonId: z.string().uuid(),
      lessonName: z.string(),
      status: z.string(),
      completedAt: z.string().datetime().nullable(),
      updatedAt: z.string().datetime(),
    }),
  ),
});
export type TrailsExportData = z.infer<typeof TrailsExportDataSchema>;

/** PastoralAction excluded (CL-04 / dec-021). */
export const PastoralExportDataSchema = z.object({
  alertsAboutMe: z.array(
    z.object({
      id: z.string().uuid(),
      signalType: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
  notesAboutMe: z.array(
    z.object({
      id: z.string().uuid(),
      noteType: z.string(),
      occurredAt: z.string().datetime(),
      content: z.string(),
    }),
  ),
});
export type PastoralExportData = z.infer<typeof PastoralExportDataSchema>;

export const ConsentExportDataSchema = z.object({
  acceptances: z.array(
    z.object({
      documentType: z.string(),
      version: z.string(),
      acceptedAt: z.string().datetime(),
    }),
  ),
  withdrawals: z.array(
    z.object({
      consentType: z.string(),
      timestamp: z.string().datetime(),
    }),
  ),
});
export type ConsentExportData = z.infer<typeof ConsentExportDataSchema>;

export const AuditExportDataSchema = z.object({
  events: z.array(
    z.object({
      action: z.string(),
      resource: z.string(),
      resourceId: z.string().nullable(),
      timestamp: z.string().datetime(),
    }),
  ),
});
export type AuditExportData = z.infer<typeof AuditExportDataSchema>;

// ─── Full Export Payload Schema ───────────────────────────────────────────────

export const FullExportPayloadSchema = z.object({
  exportedAt: z.string().datetime(),
  format: z.enum(['json', 'pdf']),
  user: UserExportDataSchema,
  tenants: z.array(
    z.object({
      tenantId: z.string().uuid(),
      groups: GroupsExportDataSchema,
      meetings: MeetingsExportDataSchema,
      trails: TrailsExportDataSchema,
      pastoral: PastoralExportDataSchema,
      consent: ConsentExportDataSchema,
      audit: AuditExportDataSchema,
    }),
  ),
});
export type FullExportPayload = z.infer<typeof FullExportPayloadSchema>;
