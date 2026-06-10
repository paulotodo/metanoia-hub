import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Worker } from 'bullmq';
import {
  LESSON_PROGRESS_QUEUE_NAME,
  TRAIL_PROGRESS_EVENTS_QUEUE_NAME,
  type LessonProgressJobPayload,
  type TrailProgressUpdatedEvent,
} from '@metanoia/types';
import { generateId } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requestContext } from '../../common/context/request-context';

@Injectable()
export class ProgressProcessor implements OnModuleInit {
  private readonly logger = new Logger(ProgressProcessor.name);
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.worker = this.bullMqService.createWorker(
      LESSON_PROGRESS_QUEUE_NAME,
      async (job: Job<LessonProgressJobPayload>) => this.process(job),
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'lesson-progress job failed',
      );
    });

    this.logger.log('lesson-progress worker started');
  }

  private async process(job: Job<LessonProgressJobPayload>): Promise<void> {
    const { userId, lessonId, tenantId, progressPercent } = job.data;
    const correlationId = `progress-job-${job.id ?? 'unknown'}`;

    // Worker runs outside HTTP lifecycle — manually set RequestContext for RLS
    await requestContext.run(
      {
        tenantId,
        userId,
        requestId: generateId(),
        correlationId,
      },
      async () => {
        try {
          await this.upsertLessonProgress(tenantId, userId, lessonId, progressPercent, correlationId);
        } catch (error) {
          this.logger.error(
            { tenantId, userId, lessonId, jobId: job.id, error: (error as Error).message },
            'lesson-progress processing failed',
          );
          throw error; // Re-throw so BullMQ retries
        }
      },
    );
  }

  private async upsertLessonProgress(
    tenantId: string,
    userId: string,
    lessonId: string,
    progressPercent: number,
    correlationId: string,
  ): Promise<void> {
    const now = new Date();

    const status = progressPercent >= 100 ? 'completed' : progressPercent > 0 ? 'in_progress' : 'not_started';

    await this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

      // Upsert LessonProgress
      const existing = await tx.lessonProgress.findUnique({
        where: { tenantId_userId_lessonId: { tenantId, userId, lessonId } },
      });

      const previousStatus = existing?.status ?? 'not_started';

      if (!existing) {
        await tx.lessonProgress.create({
          data: {
            id: generateId(),
            tenantId,
            userId,
            lessonId,
            status,
            progressPercent,
            startedAt: progressPercent > 0 ? now : null,
            completedAt: status === 'completed' ? now : null,
            lastAccessedAt: now,
          },
        });
      } else {
        // Only update if new percent is higher (progress never goes back)
        if (progressPercent >= existing.progressPercent) {
          await tx.lessonProgress.update({
            where: { id: existing.id },
            data: {
              status,
              progressPercent,
              startedAt: existing.startedAt ?? (progressPercent > 0 ? now : null),
              completedAt: status === 'completed' && !existing.completedAt ? now : existing.completedAt,
              lastAccessedAt: now,
            },
          });
        }
      }

      // Only recalculate upstream if lesson was just completed
      const justCompleted = status === 'completed' && previousStatus !== 'completed';
      if (!justCompleted) return;

      // Get lesson → module → trail context
      const lesson = await tx.lesson.findUnique({
        where: { id: lessonId },
        select: { moduleId: true, tenantId: true, module: { select: { trailId: true } } },
      });

      if (!lesson) return;

      const moduleId = lesson.moduleId;
      const trailId = lesson.module.trailId;

      // Recalculate ModuleProgress
      const allModuleLessons = await tx.lesson.findMany({
        where: { moduleId, deletedAt: null },
        select: { id: true },
      });
      const totalLessons = allModuleLessons.length;
      const completedLessonIds = allModuleLessons.map((l) => l.id);

      const completedLessonsCount = await tx.lessonProgress.count({
        where: {
          tenantId,
          userId,
          lessonId: { in: completedLessonIds },
          status: 'completed',
        },
      });

      const modulePercent = totalLessons > 0
        ? Math.floor((completedLessonsCount / totalLessons) * 100)
        : 0;
      const moduleCompleted = completedLessonsCount === totalLessons && totalLessons > 0;

      const existingModuleProgress = await tx.moduleProgress.findUnique({
        where: { tenantId_userId_moduleId: { tenantId, userId, moduleId } },
      });

      if (!existingModuleProgress) {
        await tx.moduleProgress.create({
          data: {
            id: generateId(),
            tenantId,
            userId,
            moduleId,
            progressPercent: modulePercent,
            completedLessons: completedLessonsCount,
            totalLessons,
            completedAt: moduleCompleted ? now : null,
          },
        });
      } else {
        await tx.moduleProgress.update({
          where: { id: existingModuleProgress.id },
          data: {
            progressPercent: modulePercent,
            completedLessons: completedLessonsCount,
            totalLessons,
            completedAt: moduleCompleted && !existingModuleProgress.completedAt ? now : existingModuleProgress.completedAt,
          },
        });
      }

      // Only recalculate TrailProgress if module just completed
      if (!moduleCompleted) return;

      const allTrailModules = await tx.module.findMany({
        where: { trailId, deletedAt: null },
        select: { id: true },
      });
      const totalModules = allTrailModules.length;
      const allModuleIds = allTrailModules.map((m) => m.id);

      const completedModulesCount = await tx.moduleProgress.count({
        where: {
          tenantId,
          userId,
          moduleId: { in: allModuleIds },
          completedAt: { not: null },
        },
      });

      const trailPercent = totalModules > 0
        ? Math.floor((completedModulesCount / totalModules) * 100)
        : 0;
      const trailCompleted = completedModulesCount === totalModules && totalModules > 0;

      const existingTrailProgress = await tx.trailProgress.findUnique({
        where: { tenantId_userId_trailId: { tenantId, userId, trailId } },
      });

      const previousTrailPercent = existingTrailProgress?.progressPercent ?? 0;

      if (!existingTrailProgress) {
        await tx.trailProgress.create({
          data: {
            id: generateId(),
            tenantId,
            userId,
            trailId,
            progressPercent: trailPercent,
            completedModules: completedModulesCount,
            totalModules,
            completedAt: trailCompleted ? now : null,
          },
        });
      } else {
        await tx.trailProgress.update({
          where: { id: existingTrailProgress.id },
          data: {
            progressPercent: trailPercent,
            completedModules: completedModulesCount,
            totalModules,
            completedAt: trailCompleted && !existingTrailProgress.completedAt ? now : existingTrailProgress.completedAt,
          },
        });
      }

      // Emit domain event content.trail.progress_updated via BullMQ bus
      // Consumer: Pastoral module — Story 6.9 (planned tech debt, not implemented here)
      if (trailPercent !== previousTrailPercent) {
        await this.emitTrailProgressEvent(
          tenantId, userId, trailId, trailPercent, previousTrailPercent, correlationId,
        );
      }
    });
  }

  private async emitTrailProgressEvent(
    tenantId: string,
    userId: string,
    trailId: string,
    progressPercent: number,
    previousPercent: number,
    correlationId: string,
  ): Promise<void> {
    const event: TrailProgressUpdatedEvent = {
      eventId: generateId(),
      eventType: 'content.trail.progress_updated',
      version: 1,
      tenantId,
      timestamp: new Date().toISOString(),
      data: { userId, trailId, progressPercent, previousPercent },
      metadata: { correlationId },
    };

    const eventsQueue = this.bullMqService.createQueue(TRAIL_PROGRESS_EVENTS_QUEUE_NAME);
    await eventsQueue.add('trail-progress-updated', event, {
      removeOnComplete: { count: 500 },
      removeOnFail: false,
    });

    this.logger.log(
      { tenantId, userId, trailId, progressPercent, previousPercent },
      'domain event content.trail.progress_updated emitted',
    );
  }
}
