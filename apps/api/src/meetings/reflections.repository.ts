import { Injectable } from '@nestjs/common';
import type { Reflection } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

@Injectable()
export class ReflectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    id: string;
    meetingId: string;
    leaderId: string;
    text: string;
  }): Promise<Reflection> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.reflection.create({
        data: {
          id: input.id,
          tenantId,
          meetingId: input.meetingId,
          leaderId: input.leaderId,
          text: input.text,
        },
      }),
    );
  }

  async findByMeeting(meetingId: string): Promise<Reflection[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.reflection.findMany({
        where: { meetingId },
        orderBy: { recordedAt: 'desc' },
      }),
    );
  }
}
