import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import {
  VideoProviderSignatureError,
  type CreateRoomOptions,
  type GenerateTokenOptions,
  type ProviderParticipant,
  type ProviderRoom,
  type VideoProviderEvent,
} from '@metanoia/types';
import type { EnvConfig } from '../../config/env.validation';
import type { VideoProviderAdapter } from './video-provider.adapter';

/**
 * Story 5.2 — MVP `VideoProviderAdapter` implementation backed by LiveKit.
 *
 * Wraps `livekit-server-sdk` so domain code (MeetingsService, webhook
 * controller) depends only on the abstract contract and the SDK never leaks
 * outside this file.
 */
@Injectable()
export class LiveKitAdapter implements VideoProviderAdapter {
  private readonly logger = new Logger(LiveKitAdapter.name);
  private readonly roomClient: RoomServiceClient;
  private readonly webhookReceiver: WebhookReceiver;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly livekitUrl: string;

  constructor(configService: ConfigService<EnvConfig, true>) {
    this.apiKey = configService.get('LIVEKIT_API_KEY', { infer: true });
    this.apiSecret = configService.get('LIVEKIT_API_SECRET', { infer: true });
    this.livekitUrl = configService.get('LIVEKIT_URL', { infer: true });
    this.roomClient = new RoomServiceClient(
      this.livekitUrl,
      this.apiKey,
      this.apiSecret,
    );
    this.webhookReceiver = new WebhookReceiver(this.apiKey, this.apiSecret);
  }

  roomNameFor(tenantId: string, meetingId: string): string {
    return `${tenantId}:${meetingId}`;
  }

  getProviderUrl(): string {
    return this.livekitUrl;
  }

  async createRoom(options: CreateRoomOptions): Promise<ProviderRoom> {
    const created = await this.roomClient.createRoom({
      name: options.roomName,
      ...(options.maxParticipants
        ? { maxParticipants: options.maxParticipants }
        : {}),
      ...(options.emptyTimeoutSeconds
        ? { emptyTimeout: options.emptyTimeoutSeconds }
        : {}),
      ...(options.metadata ? { metadata: JSON.stringify(options.metadata) } : {}),
    });
    this.logger.log(
      { roomName: options.roomName, roomSid: created.sid },
      'livekit room created',
    );
    return {
      roomId: created.sid,
      roomName: options.roomName,
      livekitUrl: this.livekitUrl,
    };
  }

  async deleteRoom(roomName: string): Promise<void> {
    try {
      await this.roomClient.deleteRoom(roomName);
      this.logger.log({ roomName }, 'livekit room deleted');
    } catch (error) {
      this.logger.warn(
        { roomName, error: (error as Error).message },
        'livekit deleteRoom failed (may be already closed)',
      );
    }
  }

  async generateToken(options: GenerateTokenOptions): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: options.identity,
      name: options.participantName ?? options.identity,
      ttl: options.ttlSeconds ?? 3600,
      ...(options.metadata
        ? { metadata: JSON.stringify(options.metadata) }
        : {}),
    });
    token.addGrant({
      roomJoin: true,
      room: options.roomName,
      canPublish: options.canPublish ?? true,
      canSubscribe: options.canSubscribe ?? true,
    });
    return token.toJwt();
  }

  async getActiveParticipants(
    roomName: string,
  ): Promise<ProviderParticipant[]> {
    try {
      const list = await this.roomClient.listParticipants(roomName);
      return list.map((p) => ({
        identity: p.identity,
        name: p.name ?? null,
        joinedAt: p.joinedAt
          ? new Date(Number(p.joinedAt) * 1000).toISOString()
          : null,
        metadata: p.metadata ?? null,
      }));
    } catch (error) {
      this.logger.warn(
        { roomName, error: (error as Error).message },
        'listParticipants failed (room may be empty or closed)',
      );
      return [];
    }
  }

  async handleWebhook(
    authorizationHeader: string | null,
    rawBody: string,
  ): Promise<VideoProviderEvent> {
    if (!authorizationHeader) {
      throw new VideoProviderSignatureError('Missing authorization header');
    }
    let event;
    try {
      event = await this.webhookReceiver.receive(rawBody, authorizationHeader);
    } catch {
      throw new VideoProviderSignatureError('Invalid webhook signature');
    }

    const roomName = event.room?.name ?? '';
    const { tenantId, meetingId } = parseRoomName(roomName);
    const timestamp = new Date().toISOString();

    switch (event.event) {
      case 'room_started':
        return {
          type: 'room.started',
          roomName,
          tenantId,
          meetingId,
          timestamp,
          roomId: event.room?.sid ?? null,
        };
      case 'room_finished':
        return {
          type: 'room.finished',
          roomName,
          tenantId,
          meetingId,
          timestamp,
          roomId: event.room?.sid ?? null,
        };
      case 'participant_joined':
        return {
          type: 'participant.joined',
          roomName,
          tenantId,
          meetingId,
          timestamp,
          participantIdentity: event.participant?.identity ?? 'anonymous',
          participantSid: event.participant?.sid ?? null,
        };
      case 'participant_left':
        return {
          type: 'participant.left',
          roomName,
          tenantId,
          meetingId,
          timestamp,
          participantIdentity: event.participant?.identity ?? 'anonymous',
          participantSid: event.participant?.sid ?? null,
        };
      default:
        return {
          type: 'unknown',
          roomName,
          tenantId,
          meetingId,
          timestamp,
          rawEvent: event.event ?? 'undefined',
        };
    }
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses `{tenantId}:{meetingId}` room names; returns nulls when malformed. */
function parseRoomName(roomName: string): {
  tenantId: string | null;
  meetingId: string | null;
} {
  const parts = roomName.split(':');
  if (parts.length !== 2) return { tenantId: null, meetingId: null };
  const [tenantId, meetingId] = parts;
  if (!tenantId || !meetingId) return { tenantId: null, meetingId: null };
  return {
    tenantId: UUID_RE.test(tenantId) ? tenantId : null,
    meetingId: UUID_RE.test(meetingId) ? meetingId : null,
  };
}
