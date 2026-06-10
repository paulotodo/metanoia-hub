import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { getRequestContext } from '../../common/context/request-context';

/**
 * AccessControlService — enforces sequential-access rules for trails and modules.
 *
 * Trail sequential:  participant can access module N only if module N-1 (by order)
 *                    has a ModuleProgress.completedAt for the current user.
 * Module sequential: participant can access lesson N only if lesson N-1 (by order)
 *                    has LessonProgress.status === 'completed' for the current user.
 * Prerequisites:     participant can access a module only when ALL declared
 *                    ModulePrerequisite rows for that module are completed.
 *
 * When trail accessMode === 'free', module sequential is still applied independently.
 */
@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asserts the current user is allowed to access the given module.
   * Throws ForbiddenException (403) if access is denied.
   * Throws NotFoundException (404) if module or trail not found.
   */
  async assertModuleAccess(trailId: string, moduleId: string): Promise<void> {
    const ctx = getRequestContext();
    const userId = ctx.userId;
    if (!userId) throw new ForbiddenException('Autenticação necessária');

    await withTenantTx(this.prisma, async (tx) => {
      // Load trail with access mode
      const trail = await tx.trail.findFirst({
        where: { id: trailId, deletedAt: null },
        select: { accessMode: true },
      });
      if (!trail) throw new NotFoundException('Trilha não encontrada');

      // Load requested module
      const targetModule = await tx.module.findFirst({
        where: { id: moduleId, trailId, deletedAt: null },
        select: { id: true, order: true },
      });
      if (!targetModule) throw new NotFoundException('Módulo não encontrado');

      if (trail.accessMode === 'sequential') {
        // Modules must be completed in order; check the previous module
        const previousModule = await tx.module.findFirst({
          where: {
            trailId,
            deletedAt: null,
            order: { lt: targetModule.order },
          },
          orderBy: { order: 'desc' },
          select: { id: true },
        });

        if (previousModule) {
          const prevProgress = await tx.moduleProgress.findFirst({
            where: { userId, moduleId: previousModule.id },
            select: { completedAt: true },
          });
          if (!prevProgress?.completedAt) {
            throw new ForbiddenException(
              'Complete o módulo anterior para desbloquear este conteúdo',
            );
          }
        }
      }

      // Prerequisite check (independent of trail accessMode)
      const prerequisites = await tx.modulePrerequisite.findMany({
        where: { moduleId },
        select: { prerequisiteModuleId: true },
      });

      if (prerequisites.length > 0) {
        const prereqIds = prerequisites.map((p) => p.prerequisiteModuleId);
        const completedPrereqs = await tx.moduleProgress.findMany({
          where: {
            userId,
            moduleId: { in: prereqIds },
            completedAt: { not: null },
          },
          select: { moduleId: true },
        });
        const completedIds = new Set(completedPrereqs.map((p) => p.moduleId));
        const allComplete = prereqIds.every((id) => completedIds.has(id));
        if (!allComplete) {
          throw new ForbiddenException(
            'Complete o módulo anterior para desbloquear este conteúdo',
          );
        }
      }
    });
  }

  /**
   * Asserts the current user is allowed to access the given lesson.
   * Applies module-level lessonAccessMode check.
   * Throws ForbiddenException (403) if access is denied.
   */
  async assertLessonAccess(
    trailId: string,
    moduleId: string,
    lessonId: string,
  ): Promise<void> {
    const ctx = getRequestContext();
    const userId = ctx.userId;
    if (!userId) throw new ForbiddenException('Autenticação necessária');

    // First, enforce module access (chain check)
    await this.assertModuleAccess(trailId, moduleId);

    await withTenantTx(this.prisma, async (tx) => {
      const mod = await tx.module.findFirst({
        where: { id: moduleId, trailId, deletedAt: null },
        select: { lessonAccessMode: true },
      });
      if (!mod) throw new NotFoundException('Módulo não encontrado');

      if (mod.lessonAccessMode !== 'sequential') return; // free — allowed

      const targetLesson = await tx.lesson.findFirst({
        where: { id: lessonId, moduleId, deletedAt: null },
        select: { id: true, order: true },
      });
      if (!targetLesson) throw new NotFoundException('Aula não encontrada');

      const previousLesson = await tx.lesson.findFirst({
        where: {
          moduleId,
          deletedAt: null,
          order: { lt: targetLesson.order },
        },
        orderBy: { order: 'desc' },
        select: { id: true },
      });

      if (previousLesson) {
        const prevProgress = await tx.lessonProgress.findFirst({
          where: { userId, lessonId: previousLesson.id },
          select: { status: true },
        });
        if (prevProgress?.status !== 'completed') {
          throw new ForbiddenException(
            'Complete o módulo anterior para desbloquear este conteúdo',
          );
        }
      }
    });
  }
}
