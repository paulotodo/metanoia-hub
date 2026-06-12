import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  LESSON_PROGRESS_QUEUE_NAME,
  type LessonProgressJobPayload,
  type TrailProgressDetailResponse,
  type TrailsExportData,
  type ResumeProgressResponse,
  type LessonStatus,
} from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { withTenantTx } from '../../prisma/with-tenant-tx';

@Injectable()
export class ProgressService implements OnModuleInit {
  private readonly logger = new Logger(ProgressService.name);
  private queue!: Queue;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.queue = this.bullMqService.createQueue(LESSON_PROGRESS_QUEUE_NAME);
    this.logger.log('lesson-progress queue initialized');
  }

  /**
   * Enqueues a lesson progress event for async processing.
   * Never persists synchronously — returns 202 Accepted immediately.
   */
  async enqueueProgressEvent(
    lessonId: string,
    progressPercent: number,
    eventType: LessonProgressJobPayload['eventType'],
    completedBy?: LessonProgressJobPayload['completedBy'],
  ): Promise<void> {
    const ctx = getRequestContext();
    const { tenantId } = ctx;
    const userId = ctx.userId;
    if (!userId) {
      throw new Error('userId required in RequestContext to report progress');
    }

    const payload: LessonProgressJobPayload = {
      userId,
      lessonId,
      tenantId,
      progressPercent,
      eventType,
      ...(completedBy && { completedBy }),
    };

    await this.queue.add('update-progress', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: false, // retain failed jobs for manual inspection (NFR-I4)
    });

    this.logger.log({ tenantId, userId, lessonId, progressPercent, eventType }, 'progress event enqueued');
  }

  /**
   * Returns aggregated progress for the current user on a trail.
   */
  async getTrailProgress(trailId: string): Promise<TrailProgressDetailResponse> {
    const ctx = getRequestContext();
    const userId = ctx.userId;
    if (!userId) throw new Error('userId required');

    return withTenantTx(this.prisma, async (tx) => {
      const allModules = await tx.module.findMany({
        where: { trailId, deletedAt: null },
        orderBy: { order: 'asc' },
        select: { id: true },
      });

      const moduleIds = allModules.map((m) => m.id);

      const allLessons = await tx.lesson.findMany({
        where: { moduleId: { in: moduleIds }, deletedAt: null },
        orderBy: { order: 'asc' },
        select: { id: true, moduleId: true },
      });

      const progressRecords = await tx.lessonProgress.findMany({
        where: { userId, lessonId: { in: allLessons.map((l) => l.id) } },
      });

      const progressByLessonId = new Map(progressRecords.map((p) => [p.lessonId, p]));

      const modules = allModules.map((mod) => {
        const moduleLessons = allLessons.filter((l) => l.moduleId === mod.id);
        const lessons = moduleLessons.map((l) => {
          const p = progressByLessonId.get(l.id);
          return {
            lessonId: l.id,
            status: (p?.status ?? 'not_started') as LessonStatus,
            progressPercent: p?.progressPercent ?? 0,
            lastAccessedAt: p?.lastAccessedAt?.toISOString() ?? null,
          };
        });
        const completedLessons = lessons.filter((l) => l.status === 'completed').length;
        const totalLessons = lessons.length;
        const progressPercent = totalLessons > 0
          ? Math.floor((completedLessons / totalLessons) * 100)
          : 0;
        return { moduleId: mod.id, progressPercent, completedLessons, totalLessons, lessons };
      });

      const completedModules = modules.filter((m) => m.completedLessons === m.totalLessons && m.totalLessons > 0).length;
      const totalModules = modules.length;
      const trailProgressPercent = totalModules > 0
        ? Math.floor((completedModules / totalModules) * 100)
        : 0;

      return {
        data: {
          trailId,
          progressPercent: trailProgressPercent,
          completedModules,
          totalModules,
          modules,
        },
      };
    });
  }

  /**
   * Returns the last accessed incomplete lesson for "Continuar de onde parei".
   */
  async getResumeLesson(trailId: string): Promise<ResumeProgressResponse> {
    const ctx = getRequestContext();
    const userId = ctx.userId;
    if (!userId) throw new Error('userId required');

    return withTenantTx(this.prisma, async (tx) => {
      // Find the most recently accessed in_progress lesson in this trail
      const moduleIds = await tx.module.findMany({
        where: { trailId, deletedAt: null },
        select: { id: true },
      }).then((ms) => ms.map((m) => m.id));

      const lessonIds = await tx.lesson.findMany({
        where: { moduleId: { in: moduleIds }, deletedAt: null },
        select: { id: true, moduleId: true },
      });

      if (lessonIds.length === 0) {
        return { data: { lessonId: null, moduleId: null, lastAccessedAt: null } };
      }

      const lastAccessed = await tx.lessonProgress.findFirst({
        where: {
          userId,
          lessonId: { in: lessonIds.map((l) => l.id) },
          status: { in: ['not_started', 'in_progress'] },
        },
        orderBy: { lastAccessedAt: 'desc' },
        select: { lessonId: true, lastAccessedAt: true },
      });

      if (!lastAccessed) {
        return { data: { lessonId: null, moduleId: null, lastAccessedAt: null } };
      }

      const lessonEntry = lessonIds.find((l) => l.id === lastAccessed.lessonId);
      return {
        data: {
          lessonId: lastAccessed.lessonId,
          moduleId: lessonEntry?.moduleId ?? null,
          lastAccessedAt: lastAccessed.lastAccessedAt.toISOString(),
        },
      };
    });
  }

  /**
   * Export trail and lesson progress data for a user within a tenant.
   * Privileged — uses prisma.client directly (no RLS). Never throws.
   */
  async exportUserData(userId: string, tenantId: string): Promise<TrailsExportData> {
    const trailProgressRows = await this.prisma.client.trailProgress.findMany({
      where: { userId, tenantId },
    });

    // Fetch trail names in bulk
    const trailIds = [...new Set(trailProgressRows.map((r) => r.trailId))];
    const trails = trailIds.length
      ? await this.prisma.client.trail.findMany({
          where: { id: { in: trailIds } },
          select: { id: true, name: true },
        })
      : [];
    const trailMap = new Map(trails.map((t) => [t.id, t.name]));

    const lessonProgressRows = await this.prisma.client.lessonProgress.findMany({
      where: { userId, tenantId },
    });

    // Fetch lesson titles in bulk
    const lessonIds = [...new Set(lessonProgressRows.map((r) => r.lessonId))];
    const lessons = lessonIds.length
      ? await this.prisma.client.lesson.findMany({
          where: { id: { in: lessonIds } },
          select: { id: true, title: true },
        })
      : [];
    const lessonMap = new Map(lessons.map((l) => [l.id, l.title]));

    return {
      trailProgress: trailProgressRows.map((r) => ({
        trailId: r.trailId,
        trailName: trailMap.get(r.trailId) ?? '',
        progressPercent: r.progressPercent,
        completedAt: r.completedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      })),
      lessonProgress: lessonProgressRows.map((r) => ({
        lessonId: r.lessonId,
        lessonName: lessonMap.get(r.lessonId) ?? '',
        status: r.status.toString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }
}
