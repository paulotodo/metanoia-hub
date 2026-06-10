import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TrailVersionResponseSchema,
  TrailVersionsListResponseSchema,
  type TrailVersionResponse,
  type TrailVersionsListResponse,
} from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import type { TrailVersion } from '@prisma/client';

/**
 * VersionService — manages TrailVersion history (Story 8-6).
 *
 * Draft versioning semantics:
 * - Trail.status is authoritative: 'draft' → invisible to participants.
 * - When a published trail is edited (modules/lessons), it returns to 'draft'.
 * - Re-publishing increments Trail.version and saves a new TrailVersion snapshot.
 * - Previous TrailVersion records are immutable (audit / rollback).
 * - LessonProgress references lessonId (stable UUID v7) — never trail version.
 * - Lessons removed in a new version: orphaned LessonProgress soft-archived.
 */
@Injectable()
export class VersionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all version snapshots for a trail (newest first).
   */
  async listVersions(trailId: string): Promise<TrailVersionsListResponse> {
    const versions = await withTenantTx(this.prisma, async (tx) => {
      const trail = await tx.trail.findFirst({ where: { id: trailId, deletedAt: null } });
      if (!trail) throw new NotFoundException('Trilha não encontrada');
      return tx.trailVersion.findMany({
        where: { trailId },
        orderBy: { version: 'desc' },
      });
    });
    return TrailVersionsListResponseSchema.parse({
      data: versions.map((v) => this.toResponse(v)),
      meta: { total: versions.length },
    });
  }

  /**
   * Archive orphaned LessonProgress records for lessons that were removed in a new
   * trail version. Called by PublishingService after publish succeeds.
   *
   * "Soft-archive" = set status to 'completed' with completedAt = now()
   * (we do not delete — progress is permanent audit history).
   */
  async archiveOrphanedProgress(trailId: string): Promise<void> {
    await withTenantTx(this.prisma, async (tx) => {
      // Find all active lesson IDs still in the trail (non-deleted lessons)
      const activeLessons = await tx.lesson.findMany({
        where: {
          module: { trailId, deletedAt: null },
          deletedAt: null,
        },
        select: { id: true },
      });
      const activeLessonIds = new Set(activeLessons.map((l) => l.id));

      // Find LessonProgress for lessons belonging to this trail but not active
      // We use a raw join to scope by trail without passing tenantId as param.
      const orphaned = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT lp.id
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        JOIN modules m ON m.id = l.module_id
        WHERE m.trail_id = ${trailId}::uuid
          AND l.deleted_at IS NOT NULL
          AND lp.status != 'completed'
      `;

      const orphanedIds = orphaned
        .map((r) => r.id)
        .filter((id) => !activeLessonIds.has(id));

      if (orphanedIds.length === 0) return;

      // Soft-archive: mark completed (preserves progress history, never deletes)
      await tx.$executeRawUnsafe(
        `UPDATE lesson_progress
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        orphanedIds,
      );
    });
  }

  private toResponse(v: TrailVersion): TrailVersionResponse {
    return TrailVersionResponseSchema.parse({
      id: v.id,
      tenantId: v.tenantId,
      trailId: v.trailId,
      version: v.version,
      snapshotData: v.snapshotData as Record<string, unknown>,
      publishedAt: v.publishedAt.toISOString(),
      publishedBy: v.publishedBy,
      createdAt: v.createdAt.toISOString(),
    });
  }
}
