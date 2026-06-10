import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { CircularDependencyValidator } from '../access/circular-dependency.validator';
import type {
  ModulePrerequisiteResponse,
  PrerequisitesListResponse,
} from '@metanoia/types';

@Injectable()
export class PrerequisitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circularValidator: CircularDependencyValidator,
  ) {}

  /**
   * Replaces the full prerequisite list for a module.
   * Validates:
   *   - Module belongs to the trail
   *   - Prerequisites belong to the same trail
   *   - No self-reference
   *   - No circular dependencies
   * Returns 422 if any validation fails.
   */
  async setPrerequisites(
    trailId: string,
    moduleId: string,
    prerequisiteModuleIds: string[],
  ): Promise<PrerequisitesListResponse> {
    return withTenantTx(this.prisma, async (tx) => {
      // Assert module belongs to trail
      const targetModule = await tx.module.findFirst({
        where: { id: moduleId, trailId, deletedAt: null },
        select: { id: true },
      });
      if (!targetModule) throw new NotFoundException('Módulo não encontrado');

      if (prerequisiteModuleIds.length > 0) {
        // Assert all prerequisite modules belong to the same trail
        const prereqModules = await tx.module.findMany({
          where: {
            id: { in: prerequisiteModuleIds },
            trailId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (prereqModules.length !== prerequisiteModuleIds.length) {
          throw new UnprocessableEntityException(
            'Um ou mais pré-requisitos não pertencem a esta trilha',
          );
        }

        // Check self-reference
        for (const prereqId of prerequisiteModuleIds) {
          if (this.circularValidator.isSelfReference(moduleId, prereqId)) {
            throw new UnprocessableEntityException(
              'Um módulo não pode ser pré-requisito de si mesmo',
            );
          }
        }

        // Check circular dependency for each candidate prerequisite
        for (const prereqId of prerequisiteModuleIds) {
          const hasCycle = await this.circularValidator.wouldCreateCycle(tx, moduleId, prereqId);
          if (hasCycle) {
            throw new UnprocessableEntityException(
              `Dependência circular detectada: adicionar o módulo como pré-requisito criaria um ciclo`,
            );
          }
        }
      }

      // Delete existing prerequisites and insert new ones atomically
      await tx.modulePrerequisite.deleteMany({ where: { moduleId } });

      const moduleRow = await tx.module.findFirst({
        where: { id: moduleId },
        select: { tenantId: true },
      });
      if (!moduleRow) throw new NotFoundException('Módulo não encontrado');
      const tenantId = moduleRow.tenantId;

      if (prerequisiteModuleIds.length > 0) {
        await tx.modulePrerequisite.createMany({
          data: prerequisiteModuleIds.map((prereqId) => ({
            tenantId,
            moduleId,
            prerequisiteModuleId: prereqId,
          })),
        });
      }

      const all = await tx.modulePrerequisite.findMany({
        where: { moduleId },
        select: { moduleId: true, prerequisiteModuleId: true },
      });

      return {
        data: all.map((r): ModulePrerequisiteResponse => ({
          moduleId: r.moduleId,
          prerequisiteModuleId: r.prerequisiteModuleId,
        })),
        meta: { total: all.length },
      };
    });
  }

  /**
   * Returns the list of prerequisites for a module.
   */
  async listPrerequisites(
    trailId: string,
    moduleId: string,
  ): Promise<PrerequisitesListResponse> {
    return withTenantTx(this.prisma, async (tx) => {
      const mod = await tx.module.findFirst({
        where: { id: moduleId, trailId, deletedAt: null },
        select: { id: true },
      });
      if (!mod) throw new NotFoundException('Módulo não encontrado');

      const rows = await tx.modulePrerequisite.findMany({
        where: { moduleId },
        select: { moduleId: true, prerequisiteModuleId: true },
      });

      return {
        data: rows.map((r): ModulePrerequisiteResponse => ({
          moduleId: r.moduleId,
          prerequisiteModuleId: r.prerequisiteModuleId,
        })),
        meta: { total: rows.length },
      };
    });
  }
}
