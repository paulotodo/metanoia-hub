import { z } from 'zod';

// --- Inputs ----------------------------------------------------------------

/**
 * Story 5.2 — provider-agnostic room creation options. Each provider adapter
 * maps these to its native concepts (e.g. LiveKit `RoomServiceClient.createRoom`).
 */
export const CreateRoomOptionsSchema = z.object({
  roomName: z.string().min(1),
  maxParticipants: z.number().int().positive().max(500).optional(),
  /** Auto-close idle room after N seconds. */
  emptyTimeoutSeconds: z.number().int().positive().max(86_400).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});
export type CreateRoomOptions = z.infer<typeof CreateRoomOptionsSchema>;

export const GenerateTokenOptionsSchema = z.object({
  roomName: z.string().min(1),
  identity: z.string().min(1),
  participantName: z.string().min(1).optional(),
  /** Tenant context — embedded in token metadata for downstream isolation. */
  metadata: z.record(z.string(), z.string()).optional(),
  canPublish: z.boolean().optional(),
  canSubscribe: z.boolean().optional(),
  ttlSeconds: z.number().int().positive().max(86_400).optional(),
});
export type GenerateTokenOptions = z.infer<typeof GenerateTokenOptionsSchema>;

// --- Outputs ---------------------------------------------------------------

export const ProviderRoomSchema = z.object({
  /** Provider-side immutable room id (e.g. LiveKit `sid`). */
  roomId: z.string(),
  roomName: z.string(),
  livekitUrl: z.string(),
});
export type ProviderRoom = z.infer<typeof ProviderRoomSchema>;

export const ProviderParticipantSchema = z.object({
  identity: z.string(),
  name: z.string().nullable(),
  joinedAt: z.string().datetime().nullable(),
  metadata: z.string().nullable(),
});
export type ProviderParticipant = z.infer<typeof ProviderParticipantSchema>;

// --- Domain events emitted by adapter.handleWebhook -----------------------

export const VideoProviderEventTypeSchema = z.enum([
  'room.started',
  'room.finished',
  'participant.joined',
  'participant.left',
  'unknown',
]);
export type VideoProviderEventType = z.infer<typeof VideoProviderEventTypeSchema>;

const BaseEvent = z.object({
  type: VideoProviderEventTypeSchema,
  roomName: z.string(),
  tenantId: z.string().uuid().nullable(),
  meetingId: z.string().uuid().nullable(),
  timestamp: z.string().datetime(),
});

export const VideoProviderEventSchema = z.discriminatedUnion('type', [
  BaseEvent.extend({
    type: z.literal('room.started'),
    roomId: z.string().nullable(),
  }),
  BaseEvent.extend({
    type: z.literal('room.finished'),
    roomId: z.string().nullable(),
  }),
  BaseEvent.extend({
    type: z.literal('participant.joined'),
    participantIdentity: z.string(),
    participantSid: z.string().nullable(),
  }),
  BaseEvent.extend({
    type: z.literal('participant.left'),
    participantIdentity: z.string(),
    participantSid: z.string().nullable(),
  }),
  BaseEvent.extend({
    type: z.literal('unknown'),
    rawEvent: z.string(),
  }),
]);
export type VideoProviderEvent = z.infer<typeof VideoProviderEventSchema>;

// --- Signature validation outcomes -----------------------------------------

/**
 * Distinct sentinel error used by adapters to signal that the webhook
 * authorization header is missing or invalid. The webhook controller maps
 * this to HTTP 401 (NFR-S3 — reject unsigned/invalid webhooks).
 */
export class VideoProviderSignatureError extends Error {
  constructor(message: string = 'Invalid webhook signature') {
    super(message);
    this.name = 'VideoProviderSignatureError';
  }
}
