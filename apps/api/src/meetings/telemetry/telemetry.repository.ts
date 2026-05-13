import { Injectable } from '@nestjs/common';
import { Prisma, type MeetingTelemetry } from '@prisma/client';
import { getRequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

export interface TelemetryUpsertInput {
  id: string;
  meetingId: string;
  userId: string;
  cameraOnSeconds: number;
  roomDurationSeconds: number;
  focusScore: number | null;
}

@Injectable()
export class TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pulls ordered `track.published`/`track.unpublished` events from the
   * generic `meeting_events` flush table — same source the presence pipeline
   * uses (Story 5.3). Filtered by meeting + canonical event types.
   */
  async listTrackEventsByMeeting(meetingId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingEvent.findMany({
        where: {
          meetingId,
          eventType: {
            in: [
              'meetings.track.published',
              'meetings.track.unpublished',
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async upsertTelemetry(input: TelemetryUpsertInput): Promise<MeetingTelemetry> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingTelemetry.upsert({
        where: {
          meetingId_userId: {
            meetingId: input.meetingId,
            userId: input.userId,
          },
        },
        create: {
          id: input.id,
          tenantId,
          meetingId: input.meetingId,
          userId: input.userId,
          cameraOnSeconds: input.cameraOnSeconds,
          roomDurationSeconds: input.roomDurationSeconds,
          focusScore:
            input.focusScore === null
              ? null
              : new Prisma.Decimal(input.focusScore),
        },
        update: {
          cameraOnSeconds: input.cameraOnSeconds,
          roomDurationSeconds: input.roomDurationSeconds,
          focusScore:
            input.focusScore === null
              ? null
              : new Prisma.Decimal(input.focusScore),
        },
      }),
    );
  }
}
