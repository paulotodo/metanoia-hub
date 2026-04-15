import { Injectable } from '@nestjs/common';
import type { Reflection } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';

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
    return this.prisma.tenant.reflection.create({
      data: {
        id: input.id,
        tenantId,
        meetingId: input.meetingId,
        leaderId: input.leaderId,
        text: input.text,
      },
    });
  }

  async findByMeeting(meetingId: string): Promise<Reflection[]> {
    return this.prisma.tenant.reflection.findMany({
      where: { meetingId },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
