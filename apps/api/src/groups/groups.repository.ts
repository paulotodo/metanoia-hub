import { Injectable } from '@nestjs/common';
import type { Group } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateGroupInput {
  id: string;
  name: string;
  dayOfWeek: string;
  time: string;
  recurrence: string;
  notes: string | null;
}

/**
 * GroupsRepository — uses the RLS-aware client. The session-level
 * `app.current_tenant_id` is set by the Prisma extension, but the column still
 * needs to be populated on insert — read it from the request context.
 */
@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateGroupInput): Promise<Group> {
    const { tenantId } = getRequestContext();
    return this.prisma.tenant.group.create({
      data: {
        id: input.id,
        tenantId,
        name: input.name,
        dayOfWeek: input.dayOfWeek,
        time: input.time,
        recurrence: input.recurrence,
        notes: input.notes,
      },
    });
  }

  async countByTenant(): Promise<number> {
    return this.prisma.tenant.group.count();
  }
}
