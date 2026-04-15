import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { EnvConfig } from '../../config/env.validation';

export interface JoinTokenInput {
  roomName: string;
  userId: string;
  participantName: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
}

export interface OpenedRoom {
  roomName: string;
  livekitUrl: string;
  joinToken: string;
  roomId: string;
}

/**
 * Thin wrapper over livekit-server-sdk — centralises room naming convention
 * (`{tenantId}:{meetingId}`) and token/grant defaults so controllers/services
 * don't touch the SDK directly.
 */
@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly roomClient: RoomServiceClient;
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
  }

  /** Canonical room name used by webhook controller to parse tenant + meeting. */
  roomNameFor(tenantId: string, meetingId: string): string {
    return `${tenantId}:${meetingId}`;
  }

  async openRoom(tenantId: string, meetingId: string, leaderUserId: string, leaderName: string): Promise<OpenedRoom> {
    const roomName = this.roomNameFor(tenantId, meetingId);
    const created = await this.roomClient.createRoom({ name: roomName });
    this.logger.log({ tenantId, meetingId, roomSid: created.sid }, 'livekit room created');

    const joinToken = await this.generateJoinToken({
      roomName,
      userId: leaderUserId,
      participantName: leaderName,
      canPublish: true,
      canSubscribe: true,
    });

    return {
      roomName,
      livekitUrl: this.livekitUrl,
      joinToken,
      roomId: created.sid,
    };
  }

  async closeRoom(tenantId: string, meetingId: string): Promise<void> {
    const roomName = this.roomNameFor(tenantId, meetingId);
    try {
      await this.roomClient.deleteRoom(roomName);
      this.logger.log({ tenantId, meetingId }, 'livekit room deleted');
    } catch (error) {
      // Room may already have been cleaned up by LiveKit server-side; log but don't throw.
      this.logger.warn(
        { tenantId, meetingId, error: (error as Error).message },
        'livekit deleteRoom failed (may be already closed)',
      );
    }
  }

  async generateJoinToken(input: JoinTokenInput): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: input.userId,
      name: input.participantName,
      ttl: 3600,
    });
    token.addGrant({
      roomJoin: true,
      room: input.roomName,
      canPublish: input.canPublish ?? true,
      canSubscribe: input.canSubscribe ?? true,
    });
    return token.toJwt();
  }
}
