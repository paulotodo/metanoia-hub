import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import {
  LessonResponseSchema,
  ModuleResponseSchema,
  TrailResponseSchema,
  type CreateLessonRequest,
  type CreateModuleRequest,
  type CreateTrailRequest,
  type LessonResponse,
  type LessonsListResponse,
  type ModuleResponse,
  type ModulesListResponse,
  type ReorderLessonsRequest,
  type ReorderModulesRequest,
  type TrailResponse,
  type TrailsListResponse,
  type UpdateLessonRequest,
  type UpdateModuleRequest,
  type UpdateTrailRequest,
} from '@metanoia/types';
import type { Lesson, Module, Trail } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { ContentRepository } from './content.repository';
import { TemplateService } from './templates/template.service';
import { AltTextValidator } from './alt-text.validator';

@Injectable()
export class ContentService {
  constructor(
    private readonly repository: ContentRepository,
    private readonly templateService: TemplateService,
  ) {}

  // ---- Trails ----

  async createTrail(body: CreateTrailRequest): Promise<TrailResponse | { trailId: string }> {
    const ctx = getRequestContext();

    // If templateId provided, materialize trail from template (FR42).
    // Returns the raw object; the controller applies the single { data } wrap.
    if (body.templateId) {
      return this.templateService.materializeTrail(
        body.templateId,
        body.name,
        body.groupId,
        ctx.userId as string,
      );
    }

    const trail = await this.repository.createTrail({
      id: uuidv7(),
      name: body.name,
      description: body.description ?? null,
      status: body.status ?? 'draft',
      accessMode: body.accessMode ?? 'free',
      // userId is guaranteed present by KeycloakAuthGuard on this route
      createdBy: ctx.userId as string,
    });
    return this.trailToResponse(trail);
  }

  async listTrails(opts: {
    page: number;
    pageSize: number;
    status?: 'draft' | 'published' | 'archived';
  }): Promise<TrailsListResponse> {
    const [trails, total] = await Promise.all([
      this.repository.listTrails(opts),
      this.repository.countTrailsByTenant(opts.status),
    ]);
    return {
      data: trails.map((t) => this.trailToResponse(t)),
      meta: { total, page: opts.page, pageSize: opts.pageSize },
    };
  }

  async findTrailById(id: string): Promise<TrailResponse> {
    const trail = await this.repository.findTrailById(id);
    if (!trail) throw new NotFoundException('Trilha não encontrada');
    return this.trailToResponse(trail);
  }

  async updateTrail(id: string, body: UpdateTrailRequest): Promise<TrailResponse> {
    const updated = await this.repository.updateTrail(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.accessMode !== undefined ? { accessMode: body.accessMode } : {}),
    });
    if (!updated) throw new NotFoundException('Trilha não encontrada');
    return this.trailToResponse(updated);
  }

  async deleteTrail(id: string): Promise<void> {
    const deleted = await this.repository.softDeleteTrail(id);
    if (!deleted) throw new NotFoundException('Trilha não encontrada');
  }

  // ---- Modules ----

  async createModule(trailId: string, body: CreateModuleRequest): Promise<ModuleResponse> {
    // Ensure trail exists for tenant (repository validates internally)
    const count = await this.repository.countModulesByTrail(trailId);
    const mod = await this.repository
      .createModule({
        id: uuidv7(),
        trailId,
        name: body.name,
        order: count,
        lessonAccessMode: body.lessonAccessMode ?? 'free',
      })
      .catch((err: Error) => {
        if (err.message === 'TRAIL_NOT_FOUND') {
          throw new NotFoundException('Trilha não encontrada');
        }
        throw err;
      });
    return this.moduleToResponse(mod);
  }

  async listModules(trailId: string): Promise<ModulesListResponse> {
    await this.assertTrailExists(trailId);
    const modules = await this.repository.listModules(trailId);
    return {
      data: modules.map((m) => this.moduleToResponse(m)),
      meta: { total: modules.length },
    };
  }

  async updateModule(
    trailId: string,
    moduleId: string,
    body: UpdateModuleRequest,
  ): Promise<ModuleResponse> {
    const updated = await this.repository.updateModule(moduleId, trailId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.lessonAccessMode !== undefined ? { lessonAccessMode: body.lessonAccessMode } : {}),
    });
    if (!updated) throw new NotFoundException('Módulo não encontrado');
    return this.moduleToResponse(updated);
  }

  async deleteModule(trailId: string, moduleId: string): Promise<void> {
    const deleted = await this.repository.softDeleteModule(moduleId, trailId);
    if (!deleted) throw new NotFoundException('Módulo não encontrado');
  }

  async reorderModules(
    trailId: string,
    body: ReorderModulesRequest,
  ): Promise<ModulesListResponse> {
    await this.assertTrailExists(trailId);
    const modules = await this.repository
      .reorderModules(trailId, body.moduleIds)
      .catch((err: Error) => {
        if (
          err.message === 'REORDER_DUPLICATE_IDS' ||
          err.message === 'REORDER_WRONG_PARENT' ||
          err.message === 'REORDER_COUNT_MISMATCH'
        ) {
          throw new UnprocessableEntityException('Validação de reordenação falhou');
        }
        throw err;
      });
    return {
      data: modules.map((m) => this.moduleToResponse(m)),
      meta: { total: modules.length },
    };
  }

  // ---- Lessons ----

  async createLesson(
    trailId: string,
    moduleId: string,
    body: CreateLessonRequest,
  ): Promise<LessonResponse> {
    const lesson = await this.repository
      .createLesson({
        id: uuidv7(),
        trailId,
        moduleId,
        name: body.name,
        contentType: body.contentType,
        contentUrl: body.contentUrl ?? null,
        order: 0, // will be set to count after creation — done below
        estimatedDurationMinutes: body.estimatedDurationMinutes ?? null,
      })
      .catch((err: Error) => {
        if (err.message === 'MODULE_NOT_FOUND') {
          throw new NotFoundException('Módulo não encontrado');
        }
        throw err;
      });
    return this.lessonToResponse(lesson);
  }

  async listLessons(trailId: string, moduleId: string): Promise<LessonsListResponse> {
    await this.assertModuleExists(trailId, moduleId);
    const lessons = await this.repository.listLessons(moduleId);
    return {
      data: lessons.map((l) => this.lessonToResponse(l)),
      meta: { total: lessons.length },
    };
  }

  async getLesson(trailId: string, moduleId: string, lessonId: string): Promise<LessonResponse> {
    await this.assertModuleExists(trailId, moduleId);
    const lesson = await this.repository.findLessonById(lessonId, moduleId);
    if (!lesson) throw new NotFoundException('Aula não encontrada');
    return this.lessonToResponse(lesson);
  }

  async updateLesson(
    trailId: string,
    moduleId: string,
    lessonId: string,
    body: UpdateLessonRequest,
  ): Promise<LessonResponse> {
    const updated = await this.repository.updateLesson(lessonId, moduleId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.contentType !== undefined ? { contentType: body.contentType } : {}),
      ...(body.contentUrl !== undefined ? { contentUrl: body.contentUrl } : {}),
      ...(body.estimatedDurationMinutes !== undefined
        ? { estimatedDurationMinutes: body.estimatedDurationMinutes }
        : {}),
      ...(body.contentBody !== undefined
        ? {
            contentBody: body.contentBody,
            hasMissingAltText: AltTextValidator.hasInvalidImgs(body.contentBody),
          }
        : {}),
    });
    if (!updated) throw new NotFoundException('Aula não encontrada');
    return this.lessonToResponse(updated);
  }

  async deleteLesson(trailId: string, moduleId: string, lessonId: string): Promise<void> {
    const deleted = await this.repository.softDeleteLesson(lessonId, moduleId);
    if (!deleted) throw new NotFoundException('Aula não encontrada');
  }

  async reorderLessons(
    trailId: string,
    moduleId: string,
    body: ReorderLessonsRequest,
  ): Promise<LessonsListResponse> {
    await this.assertModuleExists(trailId, moduleId);
    const lessons = await this.repository
      .reorderLessons(moduleId, body.lessonIds)
      .catch((err: Error) => {
        if (
          err.message === 'REORDER_DUPLICATE_IDS' ||
          err.message === 'REORDER_WRONG_PARENT' ||
          err.message === 'REORDER_COUNT_MISMATCH'
        ) {
          throw new UnprocessableEntityException('Validação de reordenação falhou');
        }
        throw err;
      });
    return {
      data: lessons.map((l) => this.lessonToResponse(l)),
      meta: { total: lessons.length },
    };
  }

  // ---- Private helpers ----

  private async assertTrailExists(trailId: string): Promise<void> {
    const trail = await this.repository.findTrailById(trailId);
    if (!trail) throw new NotFoundException('Trilha não encontrada');
  }

  private async assertModuleExists(trailId: string, moduleId: string): Promise<void> {
    const mod = await this.repository.findModuleById(moduleId, trailId);
    if (!mod) throw new NotFoundException('Módulo não encontrado');
  }

  private trailToResponse(trail: Trail): TrailResponse {
    return TrailResponseSchema.parse({
      id: trail.id,
      tenantId: trail.tenantId,
      name: trail.name,
      description: trail.description ?? null,
      status: trail.status,
      accessMode: trail.accessMode,
      version: trail.version ?? null,
      publishedAt: trail.publishedAt ? trail.publishedAt.toISOString() : null,
      publishedBy: trail.publishedBy ?? null,
      catalogVisible: trail.catalogVisible,
      createdBy: trail.createdBy,
      createdAt: trail.createdAt.toISOString(),
      updatedAt: trail.updatedAt.toISOString(),
      deletedAt: trail.deletedAt ? trail.deletedAt.toISOString() : null,
    });
  }

  private moduleToResponse(mod: Module): ModuleResponse {
    return ModuleResponseSchema.parse({
      id: mod.id,
      tenantId: mod.tenantId,
      trailId: mod.trailId,
      name: mod.name,
      order: mod.order,
      lessonAccessMode: mod.lessonAccessMode,
      createdAt: mod.createdAt.toISOString(),
      updatedAt: mod.updatedAt.toISOString(),
      deletedAt: mod.deletedAt ? mod.deletedAt.toISOString() : null,
    });
  }

  private lessonToResponse(lesson: Lesson): LessonResponse {
    return LessonResponseSchema.parse({
      id: lesson.id,
      tenantId: lesson.tenantId,
      moduleId: lesson.moduleId,
      name: lesson.name,
      contentType: lesson.contentType,
      contentUrl: lesson.contentUrl ?? null,
      contentBody: lesson.contentBody ?? null,
      tags: lesson.tags,
      originalName: lesson.originalName ?? null,
      mimeType: lesson.mimeType ?? null,
      sizeBytes: lesson.sizeBytes !== null && lesson.sizeBytes !== undefined ? Number(lesson.sizeBytes) : null,
      uploadedBy: lesson.uploadedBy ?? null,
      uploadedAt: lesson.uploadedAt ? lesson.uploadedAt.toISOString() : null,
      order: lesson.order,
      estimatedDurationMinutes: lesson.estimatedDurationMinutes ?? null,
      hasMissingAltText: lesson.hasMissingAltText,
      createdAt: lesson.createdAt.toISOString(),
      updatedAt: lesson.updatedAt.toISOString(),
      deletedAt: lesson.deletedAt ? lesson.deletedAt.toISOString() : null,
    });
  }
}
