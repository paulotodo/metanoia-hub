import { z } from 'zod';

// Channel object: inApp + email booleans
export const NotificationPreferenceChannelsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
});
export type NotificationPreferenceChannels = z.infer<typeof NotificationPreferenceChannelsSchema>;

// The 7 notification types (matches NotificationTypeSchema in notification.ts)
const NOTIFICATION_TYPES = [
  'pastoral_alert',
  'group_message',
  'content_update',
  'meeting_reminder',
  'system',
  'export_ready',
  'content_new',
] as const;

// Full preferences object: one channel config per type
export const NotificationPreferencesSchema = z.object({
  pastoral_alert: NotificationPreferenceChannelsSchema,
  group_message: NotificationPreferenceChannelsSchema,
  content_update: NotificationPreferenceChannelsSchema,
  meeting_reminder: NotificationPreferenceChannelsSchema,
  system: NotificationPreferenceChannelsSchema,
  export_ready: NotificationPreferenceChannelsSchema,
  content_new: NotificationPreferenceChannelsSchema,
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

// Partial update schema — each type optional, each channel optional within type
// .strict() at root rejects unknown top-level keys
// inner .partial().strict() rejects unknown channel keys per type
const PartialChannelsSchema = NotificationPreferenceChannelsSchema.partial().strict();

export const UpdateNotificationPreferencesSchema = z
  .object({
    pastoral_alert: PartialChannelsSchema.optional(),
    group_message: PartialChannelsSchema.optional(),
    content_update: PartialChannelsSchema.optional(),
    meeting_reminder: PartialChannelsSchema.optional(),
    system: PartialChannelsSchema.optional(),
    export_ready: PartialChannelsSchema.optional(),
    content_new: PartialChannelsSchema.optional(),
  })
  .strict();
export type UpdateNotificationPreferences = z.infer<typeof UpdateNotificationPreferencesSchema>;

// Export the types array for iteration
export { NOTIFICATION_TYPES };
