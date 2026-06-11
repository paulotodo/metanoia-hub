import { Injectable } from '@nestjs/common';
import {
  type MyTrailItem,
  type MyTrailStatus,
  type MyTrailsResponse,
} from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { withTenantTx } from '../../prisma/with-tenant-tx';

@Injectable()
export class MyTrailsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List published trails assigned to the groups of the current participant.
   * Aggregates: moduleCount, lessonCount, progressPercent, status, lastActivity.
   * Sort: in_progress (lastActivity DESC) → not_started → completed.
   * Cursor-based pagination (cursor = last trail id).
   */
  async listMyTrails(
    cursor?: string,
    limit = 10,
  ): Promise<MyTrailsResponse> {
    const ctx = getRequestContext();
    const userId = ctx.userId;
    if (!userId) {
      throw new Error('userId required in RequestContext');
    }

    return withTenantTx(this.prisma, async (tx) => {
      // 1. Find groups the user belongs to
      const memberships = await tx.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      });
      const groupIds = memberships.map((m) => m.groupId);

      if (groupIds.length === 0) {
        return { data: [], meta: { nextCursor: null, total: 0 } };
      }

      // 2. Find distinct trail IDs assigned to those groups
      const groupTrails = await tx.groupTrail.findMany({
        where: { groupId: { in: groupIds } },
        select: { trailId: true },
        distinct: ['trailId'],
      });
      const trailIds = groupTrails.map((gt) => gt.trailId);

      if (trailIds.length === 0) {
        return { data: [], meta: { nextCursor: null, total: 0 } };
      }

      // 3. Total count (before pagination)
      const total = await tx.trail.count({
        where: { id: { in: trailIds }, status: 'published', deletedAt: null },
      });

      // 4. Fetch trails (with cursor pagination — fetch limit+1 to detect next page)
      const trails = await tx.trail.findMany({
        where: { id: { in: trailIds }, status: 'published', deletedAt: null },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
        orderBy: { createdAt: 'asc' }, // stable order for cursor; re-sorted below
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      const hasNextPage = trails.length > limit;
      const trailsPage = hasNextPage ? trails.slice(0, limit) : trails;
      const nextCursor = hasNextPage ? (trailsPage[trailsPage.length - 1]?.id ?? null) : null;

      if (trailsPage.length === 0) {
        return { data: [], meta: { nextCursor: null, total } };
      }

      // 5. Fetch module counts per trail
      const pageTrailIds = trailsPage.map((t) => t.id);

      const moduleCounts = await tx.module.groupBy({
        by: ['trailId'],
        where: { trailId: { in: pageTrailIds }, deletedAt: null },
        _count: { id: true },
      });
      const moduleCountMap = new Map(moduleCounts.map((m) => [m.trailId, m._count.id]));

      // 6. Fetch lesson counts per trail (via modules)
      const modules = await tx.module.findMany({
        where: { trailId: { in: pageTrailIds }, deletedAt: null },
        select: { id: true, trailId: true },
      });
      const moduleIdToTrailId = new Map(modules.map((m) => [m.id, m.trailId]));
      const moduleIds = modules.map((m) => m.id);

      const lessonCounts = await tx.lesson.groupBy({
        by: ['moduleId'],
        where: { moduleId: { in: moduleIds }, deletedAt: null },
        _count: { id: true },
      });

      const lessonCountByTrail = new Map<string, number>();
      for (const lc of lessonCounts) {
        const trailId = moduleIdToTrailId.get(lc.moduleId);
        if (trailId) {
          lessonCountByTrail.set(trailId, (lessonCountByTrail.get(trailId) ?? 0) + lc._count.id);
        }
      }

      // 7. Fetch TrailProgress for current user
      const progressRecords = await tx.trailProgress.findMany({
        where: { trailId: { in: pageTrailIds }, userId },
        select: {
          trailId: true,
          progressPercent: true,
          completedAt: true,
          updatedAt: true,
        },
      });
      const progressMap = new Map(progressRecords.map((p) => [p.trailId, p]));

      // 8. Aggregate and compute status
      const items: MyTrailItem[] = trailsPage.map((trail) => {
        const progress = progressMap.get(trail.id);
        const progressPercent = progress?.progressPercent ?? 0;
        const completedAt = progress?.completedAt ?? null;
        const lastActivity = progress?.updatedAt ? progress.updatedAt.toISOString() : null;

        let status: MyTrailStatus;
        if (completedAt !== null) {
          status = 'completed';
        } else if (progressPercent > 0) {
          status = 'in_progress';
        } else {
          status = 'not_started';
        }

        return {
          id: trail.id,
          name: trail.name,
          description: trail.description ?? null,
          moduleCount: moduleCountMap.get(trail.id) ?? 0,
          lessonCount: lessonCountByTrail.get(trail.id) ?? 0,
          progressPercent,
          status,
          lastActivity,
        };
      });

      // 9. Sort: in_progress (lastActivity DESC) → not_started → completed
      const ORDER: Record<MyTrailStatus, number> = {
        in_progress: 0,
        not_started: 1,
        completed: 2,
      };
      items.sort((a, b) => {
        const diff = ORDER[a.status] - ORDER[b.status];
        if (diff !== 0) return diff;
        // Secondary sort for in_progress: lastActivity DESC
        if (a.status === 'in_progress' && b.status === 'in_progress') {
          const aTs = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const bTs = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return bTs - aTs;
        }
        return 0;
      });

      return { data: items, meta: { nextCursor, total } };
    });
  }
}
