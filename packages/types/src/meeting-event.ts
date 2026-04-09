import { z } from 'zod';

export const MeetingEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  version: z.number().int().positive(),
  tenantId: z.string().uuid(),
  meetingId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  data: z.unknown(),
  metadata: z.unknown().optional(),
});

export type MeetingEvent = z.infer<typeof MeetingEventSchema>;

export const LiveKitWebhookEventSchema = z.object({
  event: z.string(),
  room: z.object({
    name: z.string(),
    sid: z.string(),
  }),
  participant: z
    .object({
      identity: z.string(),
      sid: z.string(),
    })
    .optional(),
  id: z.string(),
  createdAt: z.string().or(z.number()),
});

export type LiveKitWebhookEvent = z.infer<typeof LiveKitWebhookEventSchema>;
