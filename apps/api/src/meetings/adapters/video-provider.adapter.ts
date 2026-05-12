import type {
  CreateRoomOptions,
  GenerateTokenOptions,
  ProviderParticipant,
  ProviderRoom,
  VideoProviderEvent,
} from '@metanoia/types';

/**
 * DI token for the active video provider adapter. Modules consuming video
 * features inject this rather than a concrete class to keep the integration
 * provider-agnostic (Story 5.2).
 *
 * Bind in module providers as:
 *   { provide: VIDEO_PROVIDER_ADAPTER, useClass: LiveKitAdapter }
 */
export const VIDEO_PROVIDER_ADAPTER = Symbol.for(
  'metanoia.video-provider.adapter',
);

/**
 * Story 5.2 — provider-agnostic video integration contract. The MVP
 * implementation is LiveKitAdapter; future swaps (e.g. Twilio, Daily.co) must
 * adhere to this surface so callers don't change.
 */
export interface VideoProviderAdapter {
  /** Provider-neutral room name → adapter maps to its own room id. */
  roomNameFor(tenantId: string, meetingId: string): string;

  /** Adapter-side connection URL — used by clients to join the room. */
  getProviderUrl(): string;

  createRoom(options: CreateRoomOptions): Promise<ProviderRoom>;

  deleteRoom(roomName: string): Promise<void>;

  generateToken(options: GenerateTokenOptions): Promise<string>;

  getActiveParticipants(roomName: string): Promise<ProviderParticipant[]>;

  /**
   * Validates the provider's webhook signature against shared secret and
   * parses the payload into a typed domain event. Throws
   * `VideoProviderSignatureError` from `@metanoia/types` if the signature
   * is missing or invalid (controller maps to HTTP 401).
   */
  handleWebhook(
    authorizationHeader: string | null,
    rawBody: string,
  ): Promise<VideoProviderEvent>;
}
