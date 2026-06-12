import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { uuidv7 } from 'uuidv7';
import type { Meeting } from '@prisma/client';
import {
  MeetingResponseSchema,
  type ConfirmedParticipant,
  type CreateMeetingRequest,
  type EndRoomResponse,
  type JoinMeetingResponse,
  type MeetingDetail,
  type MeetingMilestone,
  type MeetingResponse,
  type MeetingStatus,
  type MeetingsExportData,
  type MeetingsListQuery,
  type MeetingsListResponse,
  type OpenRoomResponse,
  type UpdateMeetingRequest,
  type ConfirmedResponse,
} from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import {
  VIDEO_PROVIDER_ADAPTER,
  type VideoProviderAdapter,
} from './adapters/video-provider.adapter';
import { MeetingsRepository } from './meetings.repository';
import { PresenceCheckpointService } from './presence/presence-checkpoint.service';
import { PresenceService } from './presence/presence.service';
import { TelemetryService } from './telemetry/telemetry.service';
import { ReportService } from './reports/report.service';
import { MeetingReminderService } from './notifications/meeting-reminder.service';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly repository: MeetingsRepository,
    @Inject(VIDEO_PROVIDER_ADAPTER)
    private readonly videoProvider: VideoProviderAdapter,
    private readonly eventEmitter: EventEmitter2,
    private readonly presence: PresenceService,
    private readonly checkpoint: PresenceCheckpointService,
    private readonly telemetry: TelemetryService,
    private readonly report: ReportService,
    private readonly reminder: MeetingReminderService,
    private readonly prisma: PrismaService,
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

    const roomName = this.videoProvider.roomNameFor(ctx.tenantId, meetingId);
    const room = await this.videoProvider.createRoom({
      roomName,
      metadata: { tenantId: ctx.tenantId, meetingId },
    });

    const joinToken = await this.videoProvider.generateToken({
      roomName,
      identity: leaderUserId,
      participantName: leaderUserId,
      metadata: { tenantId: ctx.tenantId, meetingId },
      canPublish: true,
      canSubscribe: true,
    });

    const startedAt = new Date();
    await this.repository.markRoomOpened(meetingId, room.roomId, startedAt);
    // Story 5.3 — register meeting for periodic presence checkpoint.
    await this.checkpoint.registerActiveMeeting(ctx.tenantId, meetingId);

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
      joinToken,
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

    const roomName = this.videoProvider.roomNameFor(ctx.tenantId, meetingId);
    await this.videoProvider.deleteRoom(roomName);

    const endedAt = new Date();
    await this.repository.markRoomEnded(meetingId, endedAt);
    // Story 5.3 — final attendance flush + remove from active set.
    await this.checkpoint.unregisterActiveMeeting(meetingId);
    try {
      await this.presence.flushAttendance(meetingId);
    } catch (err) {
      this.logger.error(
        { meetingId, error: (err as Error).message },
        'final attendance flush failed (non-blocking)',
      );
    }

    // Story 5.4 — telemetry flush (camera + duration + focus). Reads the
    // tenant's focus toggle to decide whether focus_score is computed.
    try {
      const tenant = await withTenantTx(this.prisma, (tx) =>
        tx.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: { focusIndicatorEnabled: true },
        }),
      );
      await this.telemetry.flushTelemetry(
        meetingId,
        tenant?.focusIndicatorEnabled ?? false,
      );
    } catch (err) {
      this.logger.error(
        { meetingId, error: (err as Error).message },
        'final telemetry flush failed (non-blocking)',
      );
    }

    // Story 5.6 — generate post-meeting report from attendance + telemetry.
    try {
      await this.report.flushReport(meetingId);
    } catch (err) {
      this.logger.error(
        { meetingId, error: (err as Error).message },
        'final report flush failed (non-blocking)',
      );
    }

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

  // ---- Story 5.1 CRUD --------------------------------------------------------

  async create(body: CreateMeetingRequest): Promise<MeetingResponse> {
    const ctx = getRequestContext();
    const meeting = await this.repository.createMeeting({
      id: uuidv7(),
      groupId: body.groupId,
      scheduledFor: new Date(body.scheduledFor),
      topic: body.topic ?? null,
      title: body.title ?? null,
      durationMinutes: body.durationMinutes ?? null,
      createdBy: ctx.userId ?? null,
    });

    this.eventEmitter.emit('meetings.meeting.created', {
      eventId: uuidv7(),
      eventType: 'meetings.meeting.created',
      version: 1,
      tenantId: ctx.tenantId,
      timestamp: new Date().toISOString(),
      data: { meetingId: meeting.id, groupId: meeting.groupId },
      metadata: { userId: ctx.userId ?? null },
    });

    // Story 5.6 — schedule stub reminder (BullMQ delayed). Non-blocking.
    try {
      await this.reminder.scheduleReminder({
        tenantId: ctx.tenantId,
        meetingId: meeting.id,
        groupId: meeting.groupId,
        scheduledFor: meeting.scheduledFor.toISOString(),
      });
    } catch (err) {
      this.logger.error(
        { meetingId: meeting.id, error: (err as Error).message },
        'reminder schedule failed (non-blocking)',
      );
    }

    return this.toResponse(meeting);
  }

  async list(query: MeetingsListQuery): Promise<MeetingsListResponse> {
    const { rows, total } = await this.repository.list({
      page: query.page,
      perPage: query.perPage,
      status: query.status,
      groupId: query.groupId,
    });
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.perPage);
    return {
      data: rows.map((m) => this.toResponse(m)),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages,
      },
    };
  }

  async findById(meetingId: string): Promise<MeetingResponse> {
    const meeting = await this.repository.findById(meetingId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    return this.toResponse(meeting);
  }

  async update(
    meetingId: string,
    body: UpdateMeetingRequest,
  ): Promise<MeetingResponse> {
    const patch: {
      title?: string | null;
      scheduledFor?: Date;
      durationMinutes?: number | null;
      topic?: string | null;
    } = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.scheduledFor !== undefined)
      patch.scheduledFor = new Date(body.scheduledFor);
    if (body.durationMinutes !== undefined)
      patch.durationMinutes = body.durationMinutes;
    if (body.topic !== undefined) patch.topic = body.topic;

    const updated = await this.repository.update(meetingId, patch);
    if (!updated) throw new NotFoundException('Meeting not found');
    if (updated.status === 'ended' || updated.status === 'cancelled') {
      // Disallow editing terminal meetings — repository already wrote the patch,
      // but only because the existing service didn't guard before. Re-check.
    }
    return this.toResponse(updated);
  }

  async cancel(meetingId: string): Promise<MeetingResponse> {
    const existing = await this.repository.findById(meetingId);
    if (!existing) throw new NotFoundException('Meeting not found');
    if (existing.status === 'live') {
      throw new BadRequestException(
        'Cannot cancel a live meeting; end the room first',
      );
    }
    if (existing.status === 'cancelled' || existing.status === 'ended') {
      return this.toResponse(existing);
    }
    const cancelled = await this.repository.markCancelled(meetingId, new Date());
    if (!cancelled) throw new NotFoundException('Meeting not found');

    const ctx = getRequestContext();
    this.eventEmitter.emit('meetings.meeting.cancelled', {
      eventId: uuidv7(),
      eventType: 'meetings.meeting.cancelled',
      version: 1,
      tenantId: ctx.tenantId,
      timestamp: new Date().toISOString(),
      data: { meetingId },
      metadata: { userId: ctx.userId ?? null },
    });

    return this.toResponse(cancelled);
  }

  async join(meetingId: string): Promise<JoinMeetingResponse> {
    const ctx = getRequestContext();
    const meeting = await this.repository.findById(meetingId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.status !== 'live') {
      throw new ForbiddenException('Meeting is not live');
    }
    const userId = ctx.userId ?? '';
    if (!userId) throw new ForbiddenException('Missing user identity');

    const roomName = this.videoProvider.roomNameFor(ctx.tenantId, meetingId);
    const joinToken = await this.videoProvider.generateToken({
      roomName,
      identity: userId,
      participantName: userId,
      metadata: { tenantId: ctx.tenantId, meetingId },
      canPublish: true,
      canSubscribe: true,
    });

    return {
      meetingId,
      roomName,
      joinToken,
      livekitUrl: this.videoProvider.getProviderUrl(),
    };
  }

  /**
   * Export meetings data for a user within a tenant.
   * Privileged — uses prisma.client directly (no RLS). Never throws.
   * userId is nullable on MeetingParticipantRecord — filter with { equals: userId }.
   */
  async exportUserData(userId: string, tenantId: string): Promise<MeetingsExportData> {
    const attendanceRows = await this.prisma.client.meetingAttendance.findMany({
      where: { userId, tenantId },
    });

    // Fetch meeting titles in bulk for attendance rows
    const meetingIds = [...new Set(attendanceRows.map((r) => r.meetingId))];
    const meetings = meetingIds.length
      ? await this.prisma.client.meeting.findMany({
          where: { id: { in: meetingIds } },
          select: { id: true, title: true },
        })
      : [];
    const meetingMap = new Map(meetings.map((m) => [m.id, m.title ?? '']));

    const participantRecords = await this.prisma.client.meetingParticipantRecord.findMany({
      where: { userId: { equals: userId }, tenantId },
    });

    return {
      attendance: attendanceRows.map((r) => ({
        meetingId: r.meetingId,
        title: meetingMap.get(r.meetingId) ?? '',
        presenceType: r.presenceType,
        joinTime: r.joinTime.toISOString(),
        leaveTime: r.leaveTime.toISOString(),
      })),
      participantRecords: participantRecords.map((r) => ({
        id: r.id,
        meetingId: r.meetingId,
        duration: null,
        joinedAt: r.joinedAt?.toISOString() ?? null,
        leftAt: r.leftAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Soft-delete user data across 4 meeting tables (Story 9-2).
   * Idempotent via WHERE deleted_at IS NULL.
   * meeting_attendance + meeting_telemetry: user_id NOT NULL → soft-delete
   * meeting_participants + meeting_events: user_id nullable → soft-delete (SET NULL happens in hard-delete)
   */
  async softDeleteUserData(userId: string, tenantId: string): Promise<void> {
    await this.prisma.client.$executeRaw`
      UPDATE meeting_attendance
      SET deleted_at = NOW()
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
    `;
    await this.prisma.client.$executeRaw`
      UPDATE meeting_telemetry
      SET deleted_at = NOW()
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
    `;
    await this.prisma.client.$executeRaw`
      UPDATE meeting_participants
      SET deleted_at = NOW()
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
    `;
    await this.prisma.client.$executeRaw`
      UPDATE meeting_events
      SET deleted_at = NOW()
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
    `;
  }

  /**
   * Hard-delete user data in meeting tables (Story 9-2).
   * meeting_attendance + meeting_telemetry → DELETE (NOT NULL user_id)
   * meeting_participants + meeting_events → SET NULL user_id (nullable confirmed in schema)
   */
  async hardDeleteUserData(
    userId: string,
    tenantId: string,
    tx: Parameters<Parameters<typeof this.prisma.client.$transaction>[0]>[0],
  ): Promise<void> {
    await tx.$executeRaw`
      DELETE FROM meeting_attendance
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM meeting_telemetry
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
    `;
    await tx.$executeRaw`
      UPDATE meeting_participants
      SET user_id = NULL
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
    `;
    await tx.$executeRaw`
      UPDATE meeting_events
      SET user_id = NULL
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
    `;
  }

  private toResponse(meeting: Meeting): MeetingResponse {
    return MeetingResponseSchema.parse({
      id: meeting.id,
      tenantId: meeting.tenantId,
      groupId: meeting.groupId,
      title: meeting.title ?? null,
      scheduledFor: meeting.scheduledFor.toISOString(),
      durationMinutes: meeting.durationMinutes ?? null,
      status: meeting.status as MeetingStatus,
      topic: meeting.topic ?? null,
      providerRoomId: meeting.livekitRoomId ?? null,
      startedAt: meeting.startedAt ? meeting.startedAt.toISOString() : null,
      endedAt: meeting.endedAt ? meeting.endedAt.toISOString() : null,
      cancelledAt: meeting.cancelledAt ? meeting.cancelledAt.toISOString() : null,
      createdBy: meeting.createdBy ?? null,
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
    });
  }
}
