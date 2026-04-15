import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ConfirmedParticipant,
  EndRoomResponse,
  MeetingDetail,
  MeetingMilestone,
  MeetingStatus,
  OpenRoomResponse,
  ConfirmedResponse,
} from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { LivekitService } from './livekit/livekit.service';
import { MeetingsRepository } from './meetings.repository';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly repository: MeetingsRepository,
    private readonly livekit: LivekitService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getDetail(meetingId: string): Promise<MeetingDetail> {
    const meeting = await this.repository.findDetailById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const confirmed: ConfirmedParticipant[] = meeting.participants.map((p) => ({
      participantId: p.participantId,
      name: p.name,
      response: p.response as ConfirmedResponse,
    }));

    // Milestones are sourced from pastoral_notes metadata in a future iteration;
    // for now the contract tolerates an empty list (FE fixture variant already handles it).
    const milestones: MeetingMilestone[] = [];

    return {
      meetingId: meeting.id,
      groupId: meeting.group.id,
      groupName: meeting.group.name,
      scheduledFor: meeting.scheduledFor.toISOString(),
      status: meeting.status as MeetingStatus,
      topic: meeting.topic ?? null,
      confirmed,
      milestones,
    };
  }

  async openRoom(meetingId: string): Promise<OpenRoomResponse> {
    const ctx = getRequestContext();
    const meeting = await this.repository.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    if (meeting.status === 'ended') {
      throw new ForbiddenException('Meeting already ended');
    }

    const leaderUserId = ctx.userId ?? '';
    if (!leaderUserId) {
      throw new ForbiddenException('Missing user identity');
    }

    const room = await this.livekit.openRoom(
      ctx.tenantId,
      meetingId,
      leaderUserId,
      leaderUserId, // participant display name: leaderUserId until we wire profile lookup
    );

    const startedAt = new Date();
    await this.repository.markRoomOpened(meetingId, room.roomId, startedAt);

    this.eventEmitter.emit('meetings.room.opened', {
      tenantId: ctx.tenantId,
      userId: leaderUserId,
      meetingId,
      roomName: room.roomName,
      timestamp: startedAt.toISOString(),
    });

    return {
      roomId: room.roomId,
      roomName: room.roomName,
      joinToken: room.joinToken,
      livekitUrl: room.livekitUrl,
      startedAt: startedAt.toISOString(),
    };
  }

  async endRoom(meetingId: string): Promise<EndRoomResponse> {
    const ctx = getRequestContext();
    const meeting = await this.repository.findById(meetingId);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    if (meeting.status === 'ended') {
      throw new ForbiddenException('Meeting already ended');
    }

    await this.livekit.closeRoom(ctx.tenantId, meetingId);

    const endedAt = new Date();
    await this.repository.markRoomEnded(meetingId, endedAt);

    this.eventEmitter.emit('meetings.room.ended', {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      meetingId,
      timestamp: endedAt.toISOString(),
    });

    return {
      meetingId,
      endedAt: endedAt.toISOString(),
    };
  }
}
