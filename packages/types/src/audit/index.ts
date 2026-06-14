import { z } from 'zod';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default page size for audit event listing */
export const AUDIT_EVENTS_PAGE_SIZE = 50;

/** BullMQ queue name for async audit log exports */
export const AUDIT_EXPORT_QUEUE_NAME = 'audit-export';

/** Redis TTL for export job state (seconds) */
export const AUDIT_EXPORT_TTL_SECONDS = 3600; // 1 hour

/**
 * Maximum JSONB payload size in bytes before truncation.
 * Payloads exceeding this are replaced with { __truncated, __originalSize, __sample }.
 * dec-019 (SEC-007)
 */
export const AUDIT_PAYLOAD_TRUNCATE_BYTES = 65536; // 64 KB

/**
 * Canonical list of audit action values.
 * dec-015 (SEC-005), data-model.md §Actions
 */
export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'auth_failure',
  'config_change',
  'export',
  'import',
  'plan_limits_override',
] as const;

/**
 * Canonical list of audit severity values.
 * dec-023 (REQ-006), audit.severity.ts mapping
 */
export const AUDIT_SEVERITIES = ['info', 'warning', 'critical'] as const;

/**
 * Resources that trigger severity=warning on UPDATE action.
 * dec-023 (REQ-006) — role-related changes require elevated attention.
 */
export const AUDIT_WARNING_RESOURCES = [
  'role',
  'permission',
  'user-role',
  'group-role',
  'member-role',
] as const;

// ─── Enums ────────────────────────────────────────────────────────────────────

export const AuditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditSeveritySchema = z.enum(AUDIT_SEVERITIES);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

// ─── Core event schema ────────────────────────────────────────────────────────

/**
 * AuditEvent — the 12-field immutable record stored in audit_events.
 * All fields map exactly to the data-model.md column definitions.
 * dec-015 (SEC-005): id generated via generateId() (UUIDv7), not DB default.
 */
export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  action: AuditActionSchema,
  resource: z.string().min(1).max(128),
  resourceId: z.string().max(128).nullable(),
  ipAddress: z.string().max(128),
  userAgent: z.string().max(512),
  /** dec-016 (SEC-011): previousState only available when service injects via AuditContext */
  previousState: z.record(z.string(), z.unknown()).nullable(),
  /** dec-019 (SEC-007): may be truncated if > AUDIT_PAYLOAD_TRUNCATE_BYTES */
  newState: z.record(z.string(), z.unknown()).nullable(),
  timestamp: z.string().datetime({ offset: true }),
  severity: AuditSeveritySchema,
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ─── List response ────────────────────────────────────────────────────────────

export const AuditEventMetaSchema = z.object({
  page: z.number().int().min(1),
  perPage: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export type AuditEventMeta = z.infer<typeof AuditEventMetaSchema>;

export const AuditEventListResponseSchema = z.object({
  data: z.array(AuditEventSchema),
  meta: AuditEventMetaSchema,
});

export type AuditEventListResponse = z.infer<typeof AuditEventListResponseSchema>;

// ─── Query schema (list + export filter) ─────────────────────────────────────

/**
 * Shared filter query for both GET /audit-events and POST /audit-events/exports.
 * dec-020 (API-003): q searches resource + resource_id via ILIKE (no JSONB GIN for MVP).
 * dec-022 (API-012): offset-based pagination.
 */
export const AuditEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(AUDIT_EVENTS_PAGE_SIZE),
  action: AuditActionSchema.optional(),
  severity: AuditSeveritySchema.optional(),
  userId: z.string().uuid().optional(),
  resource: z.string().max(128).optional(),
  /** Free-text search in resource and resource_id fields (ILIKE) */
  q: z.string().max(128).optional(),
  /** ISO 8601 — filter events at or after this timestamp */
  dateFrom: z.string().datetime({ offset: true }).optional(),
  /** ISO 8601 — filter events at or before this timestamp */
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export type AuditEventsQuery = z.infer<typeof AuditEventsQuerySchema>;

// ─── Export job ───────────────────────────────────────────────────────────────

export const AuditExportRequestSchema = AuditEventsQuerySchema.omit({
  page: true,
  perPage: true,
});

export type AuditExportRequest = z.infer<typeof AuditExportRequestSchema>;

export const AuditExportJobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(['processing', 'completed', 'failed']),
  /** Signed URL for downloading the CSV — null while processing or on failure */
  signedUrl: z.string().url().nullable(),
  /** ISO 8601 — when the signed URL expires */
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  failureReason: z.string().nullable(),
});

export type AuditExportJobStatus = z.infer<typeof AuditExportJobStatusSchema>;

// ─── BullMQ job payload ───────────────────────────────────────────────────────

export interface AuditExportJobPayload {
  jobId: string;
  /** null for super-admin cross-tenant exports */
  tenantId: string | null;
  requestedBy: string;
  query: AuditExportRequest;
}
