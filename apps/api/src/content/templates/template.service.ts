import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type {
  ContentTemplate,
  CreateTemplateRequest,
  TemplateListQuery,
  TemplateListResponse,
  TemplateStructure,
  UpdateTemplateRequest,
} from '@metanoia/types';
import { getRequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { TemplateRepository } from './template.repository';

@Injectable()
export class TemplateService {
  constructor(
    private readonly repository: TemplateRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toResponse(t: {
    id: string;
    tenantId: string | null;
    scope: string;
    sourceTrailId: string | null;
    name: string;
    description: string | null;
    version: number;
    structure: unknown;
    createdBy: string;
    createdAt: Date;
    deletedAt: Date | null;
  }): ContentTemplate {
    return {
      id: t.id,
      tenantId: t.tenantId,
      scope: t.scope as ContentTemplate['scope'],
      sourceTrailId: t.sourceTrailId,
      name: t.name,
      description: t.description,
      version: t.version,
      structure: t.structure as TemplateStructure,
      createdBy: t.createdBy,
      createdAt: t.createdAt.toISOString(),
      deletedAt: t.deletedAt?.toISOString() ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async listTemplates(query: TemplateListQuery): Promise<TemplateListResponse> {
    const [items, total] = await this.repository.findAll(query);
    return {
      data: items.map((t) => this.toResponse(t)),
      meta: { total, page: query.page, pageSize: query.pageSize },
    };
  }

  async getTemplateById(id: string): Promise<ContentTemplate> {
    const t = await this.repository.findById(id);
    if (!t) throw new NotFoundException('Template não encontrado');
    return this.toResponse(t);
  }

  async getTemplateVersions(id: string): Promise<{ data: ContentTemplate[] }> {
    const template = await this.repository.findById(id);
    if (!template) throw new NotFoundException('Template não encontrado');

    // Platform templates: read-only, return empty versions list
    if (template.scope === 'platform') {
      return { data: [] };
    }

    if (!template.sourceTrailId) {
      return { data: [] };
    }

    const versions = await this.repository.findVersionsBySourceTrailId(template.sourceTrailId);
    return { data: versions.map((v) => this.toResponse(v)) };
  }

  async createTemplate(body: CreateTemplateRequest): Promise<ContentTemplate> {
    // If sourceTrailId provided, snapshot structure from trail
    let structure: TemplateStructure;

    if (body.sourceTrailId) {
      structure = await this.snapshotTrailStructure(body.sourceTrailId);
    } else if (body.structure) {
      structure = body.structure;
    } else {
      structure = { modules: [] };
    }

    const created = await this.repository.create({
      name: body.name,
      description: body.description ?? null,
      sourceTrailId: body.sourceTrailId ?? null,
      structure,
    });

    return this.toResponse(created);
  }

  async updateTemplate(id: string, body: UpdateTemplateRequest): Promise<ContentTemplate> {
    // Check if platform template (read-only)
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundException('Template não encontrado');
    if (existing.scope === 'platform') {
      throw new ForbiddenException('Templates de plataforma são somente leitura');
    }

    const updated = await this.repository.update(id, {
      name: body.name,
      description: body.description,
    });
    if (!updated) throw new NotFoundException('Template não encontrado ou sem permissão');
    return this.toResponse(updated);
  }

  async deleteTemplate(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundException('Template não encontrado');
    if (existing.scope === 'platform') {
      throw new ForbiddenException('Templates de plataforma não podem ser excluídos');
    }

    const deleted = await this.repository.softDelete(id);
    if (!deleted) throw new NotFoundException('Template não encontrado ou sem permissão');
  }

  // ---------------------------------------------------------------------------
  // Materialização (usar template → Trail + Module + Lesson)
  // ---------------------------------------------------------------------------

  async materializeTrail(
    templateId: string,
    name?: string,
    groupId?: string,
    createdBy?: string,
  ): Promise<{ trailId: string }> {
    const { userId } = getRequestContext();
    const template = await this.repository.findByIdForMaterialization(templateId);

    if (!template) {
      throw new NotFoundException('Template não encontrado');
    }
    if (template.deletedAt) {
      throw new NotFoundException('Template não encontrado');
    }

    const structure = template.structure as TemplateStructure;
    const trailName = name ?? template.name;
    const resolvedCreatedBy = (createdBy ?? userId) as string;

    const trailId = await withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();

      // 1. Create Trail
      const trail = await tx.trail.create({
        data: {
          id: uuidv7(),
          tenantId,
          name: trailName,
          status: 'draft',
          accessMode: 'free',
          createdBy: resolvedCreatedBy,
        },
      });

      // 2. Create Modules and Lessons from structure
      for (const mod of structure.modules) {
        const module = await tx.module.create({
          data: {
            id: uuidv7(),
            tenantId,
            trailId: trail.id,
            name: mod.name,
            order: mod.order,
            lessonAccessMode: mod.lessonAccessMode ?? 'free',
          },
        });

        for (const lesson of mod.lessons) {
          await tx.lesson.create({
            data: {
              id: uuidv7(),
              tenantId,
              moduleId: module.id,
              name: lesson.name,
              contentType: lesson.contentType,
              order: lesson.order,
              estimatedDurationMinutes: lesson.estimatedDurationMinutes ?? null,
              // All content fields NULL — independent copy, no content yet
              contentUrl: null,
              contentBody: null,
              tags: [],
              originalName: null,
              mimeType: null,
              sizeBytes: null,
              uploadedBy: null,
              uploadedAt: null,
            },
          });
        }
      }

      // 3. Assign to group if groupId provided
      if (groupId) {
        await tx.groupTrail.create({
          data: {
            id: uuidv7(),
            tenantId,
            groupId,
            trailId: trail.id,
            assignedBy: resolvedCreatedBy,
          },
        });
      }

      return trail.id;
    });

    return { trailId };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async snapshotTrailStructure(trailId: string): Promise<TemplateStructure> {
    return withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();

      const trail = await tx.trail.findFirst({
        where: { id: trailId, tenantId, deletedAt: null },
        include: {
          modules: {
            where: { deletedAt: null },
            orderBy: { order: 'asc' },
            include: {
              lessons: {
                where: { deletedAt: null },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      if (!trail) {
        throw new NotFoundException('Trilha de origem não encontrada');
      }

      return {
        modules: trail.modules.map((m) => ({
          name: m.name,
          order: m.order,
          lessonAccessMode: m.lessonAccessMode as 'sequential' | 'free',
          lessons: m.lessons.map((l) => ({
            name: l.name,
            contentType: l.contentType as 'video' | 'rich_text' | 'pdf_doc' | 'external_link',
            order: l.order,
            estimatedDurationMinutes: l.estimatedDurationMinutes ?? null,
          })),
        })),
      };
    });
  }
}
