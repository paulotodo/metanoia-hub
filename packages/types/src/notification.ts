import { z } from 'zod';

// --- Enums ---

export const NotificationTypeSchema = z.enum([
  'pastoral_alert',
  'group_message',
  'content_update',
  'meeting_reminder',
  'system',
  'export_ready',   // Story 14-3: export file ready for download (signed URL)
  'content_new',    // Story 14-3: new trail/content available
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

/**
 * Notification types that bypass rate limiting and retry with shorter backoff.
 * SC-01: pastoral_alert must be delivered within ~1 min.
 * CHK050: EMAIL_CRITICAL_BACKOFF_MS=5s x 3 retries = max 15s delivery time.
 */
export const CRITICAL_NOTIFICATION_TYPES = ['pastoral_alert', 'export_ready', 'system'] as const;
export type CriticalNotificationType = typeof CRITICAL_NOTIFICATION_TYPES[number];

export const NotificationChannelSchema = z.enum(['in_app', 'email']);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationStatusSchema = z.enum(['pending', 'sent', 'failed', 'read']);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

// --- Dispatch DTO ---

export const NotificationDispatchSchema = z.object({
  userId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  channels: z.array(NotificationChannelSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type NotificationDispatch = z.infer<typeof NotificationDispatchSchema>;

// --- Channel payload / result ---

export const NotificationPayloadSchema = z.object({
  notificationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  channel: NotificationChannelSchema,
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;

export const NotificationResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});
export type NotificationResult = z.infer<typeof NotificationResultSchema>;

// --- Job payload (BullMQ) ---

export const NotificationJobPayloadSchema = z.object({
  notificationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  channel: NotificationChannelSchema,
  correlationId: z.string(),
});
export type NotificationJobPayload = z.infer<typeof NotificationJobPayloadSchema>;

// --- Realtime event (Redis pub/sub) ---

/**
 * Schema for realtime notification events published via Redis pub/sub.
 * Note: the field `notificationId` is renamed to `id` at the SSE wire boundary
 * (Story 14-2a SseRedisService mapper) — consumers of the SSE stream receive `id`,
 * not `notificationId`. This schema is the authoritative source for the Redis payload.
 */
export const NotificationRealtimeEventSchema = z.object({
  /** Renamed to `id` at the SSE wire boundary. Do not expose `notificationId` in SSE output. */
  notificationId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
});
export type NotificationRealtimeEvent = z.infer<typeof NotificationRealtimeEventSchema>;

// --- Constants ---

export const NOTIFICATIONS_QUEUE_NAME = 'notifications' as const;
export const NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS = 300000 as const;

// --- Query schema (shared FE/BE) ---

export const NotificationsQuerySchema = z.object({
  status: NotificationStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  unread: z.coerce.boolean().optional(),
  since: z.string().datetime().optional(), // ISO 8601 — gap-fill (FR-015/FR-017)
});
export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>;

// --- Read-all response schema ---

export const ReadAllResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});
export type ReadAllResponse = z.infer<typeof ReadAllResponseSchema>;

// --- Notification list item (FE consumption) ---

export const NotificationListItemSchema = z.object({
  id: z.string().uuid(),
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema,
  status: NotificationStatusSchema,
  title: z.string(),
  body: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  read_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type NotificationListItem = z.infer<typeof NotificationListItemSchema>;

export const NotificationsListSchema = z.object({
  data: z.array(NotificationListItemSchema),
  meta: z.object({
    page: z.number(),
    perPage: z.number(),
    total: z.number(),
  }),
});
export type NotificationsList = z.infer<typeof NotificationsListSchema>;
