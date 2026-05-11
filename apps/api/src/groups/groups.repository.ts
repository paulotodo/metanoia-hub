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
 * GroupsRepository — runs every read/write inside an explicit
 * `$transaction` that issues `SET LOCAL app.current_tenant_id` first. This
 * is more reliable than the global Prisma extension because `SET LOCAL`
 * only persists for statements on the same connection — the connection pool
 * routes each Prisma call to a potentially different connection unless they
 * are wrapped in a transaction.
 */
@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async withTenant<T>(
    fn: (tx: Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    const { tenantId } = getRequestContext();
    if (!tenantId) {
      throw new Error('GroupsRepository called without tenant context');
    }
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      return fn(tx);
    });
  }

  async create(input: CreateGroupInput): Promise<Group> {
    const { tenantId } = getRequestContext();
    if (!tenantId) {
      throw new Error('GroupsRepository.create called without tenant context');
    }
    return this.withTenant((tx) =>
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
    return this.withTenant((tx) => tx.group.count());
  }

  async listByTenant(): Promise<Group[]> {
    return this.withTenant((tx) =>
      tx.group.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  async findById(id: string): Promise<Group | null> {
    return this.withTenant((tx) =>
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
    }>,
  ): Promise<Group | null> {
    return this.withTenant(async (tx) => {
      const existing = await tx.group.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.group.update({ where: { id }, data: patch });
    });
  }

  async delete(id: string): Promise<Group | null> {
    return this.withTenant(async (tx) => {
      const existing = await tx.group.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.group.delete({ where: { id } });
    });
  }
}
