import { Injectable } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type { GroupTrail } from '@prisma/client';
import { getRequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

export interface CreateGroupTrailInput {
  groupId: string;
  trailId: string;
  assignedBy: string;
}

@Injectable()
export class GroupTrailsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that all given trailIds exist for the current tenant.
   * Returns the set of IDs that do NOT exist.
   */
  async findInvalidTrailIds(trailIds: string[]): Promise<string[]> {
    const { tenantId } = getRequestContext();
    const found = await withTenantTx(this.prisma, (tx) =>
      tx.trail.findMany({
        where: { id: { in: trailIds }, tenantId, deletedAt: null },
        select: { id: true },
      }),
    );
    const foundSet = new Set(found.map((t) => t.id));
    return trailIds.filter((id) => !foundSet.has(id));
  }

  /**
   * Bulk-upsert group_trails. Idempotent — existing associations are untouched.
   * Returns only the newly inserted records.
   */
  async bulkAssign(inputs: CreateGroupTrailInput[]): Promise<GroupTrail[]> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, async (tx) => {
      const created: GroupTrail[] = [];
      for (const input of inputs) {
        const existing = await tx.groupTrail.findUnique({
          where: {
            groupId_trailId: { groupId: input.groupId, trailId: input.trailId },
          },
        });
        if (existing) {
          created.push(existing);
          continue;
        }
        const record = await tx.groupTrail.create({
          data: {
            id: uuidv7(),
            tenantId,
            groupId: input.groupId,
            trailId: input.trailId,
            assignedBy: input.assignedBy,
          },
        });
        created.push(record);
      }
      return created;
    });
  }

  /**
   * Remove a single trail association. Returns the deleted record or null if
   * it did not exist.
   */
  async unassign(groupId: string, trailId: string): Promise<GroupTrail | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.groupTrail.findUnique({
        where: { groupId_trailId: { groupId, trailId } },
      });
      if (!existing) return null;
      return tx.groupTrail.delete({
        where: { groupId_trailId: { groupId, trailId } },
      });
    });
  }

  /** List all trail associations for a group. */
  async listByGroup(groupId: string): Promise<GroupTrail[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupTrail.findMany({
        where: { groupId },
        orderBy: { assignedAt: 'asc' },
      }),
    );
  }
}
