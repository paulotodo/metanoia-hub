import { Injectable } from '@nestjs/common';
import type { Group } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

export interface CreateGroupInput {
  id: string;
  name: string;
  dayOfWeek: string;
  time: string;
  recurrence: string;
  notes: string | null;
}

@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateGroupInput): Promise<Group> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.group.create({
        data: {
          id: input.id,
          tenantId,
          name: input.name,
          dayOfWeek: input.dayOfWeek,
          time: input.time,
          recurrence: input.recurrence,
          notes: input.notes,
        },
      }),
    );
  }

  async countByTenant(): Promise<number> {
    return withTenantTx(this.prisma, (tx) => tx.group.count());
  }

  async listByTenant(): Promise<Group[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.group.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  async findById(id: string): Promise<Group | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.group.findFirst({ where: { id } }),
    );
  }

  async update(
    id: string,
    patch: Partial<{
      name: string;
      dayOfWeek: string;
      time: string;
      recurrence: string;
      notes: string | null;
      // Story 13.3: recesso de grupo
      status: string;
      breakUntil: Date | null;
    }>,
  ): Promise<Group | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.group.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.group.update({ where: { id }, data: patch });
    });
  }

  async delete(id: string): Promise<Group | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.group.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.group.delete({ where: { id } });
    });
  }
}
