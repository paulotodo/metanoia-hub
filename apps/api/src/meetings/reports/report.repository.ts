import { Injectable } from '@nestjs/common';
import { Prisma, type MeetingReport } from '@prisma/client';
import { getRequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertReport(input: {
    id: string;
    meetingId: string;
    summary: Prisma.InputJsonValue;
  }): Promise<MeetingReport> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingReport.upsert({
        where: { meetingId: input.meetingId },
        create: {
          id: input.id,
          tenantId,
          meetingId: input.meetingId,
          summary: input.summary,
        },
        update: {
          summary: input.summary,
          generatedAt: new Date(),
        },
      }),
    );
  }

  async findByMeeting(meetingId: string): Promise<MeetingReport | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingReport.findUnique({ where: { meetingId } }),
    );
  }

  async listAttendanceTelemetry(meetingId: string) {
    return withTenantTx(this.prisma, async (tx) => {
      const [attendance, telemetry] = await Promise.all([
        tx.meetingAttendance.findMany({ where: { meetingId } }),
        tx.meetingTelemetry.findMany({ where: { meetingId } }),
      ]);
      return { attendance, telemetry };
    });
  }
}
