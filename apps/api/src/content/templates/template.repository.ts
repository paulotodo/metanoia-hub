import { Injectable } from '@nestjs/common';
import type { ContentTemplate } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { getRequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import type { TemplateListQuery, TemplateStructure } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  sourceTrailId?: string | null;
  structure: TemplateStructure;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
@Injectable()
export class TemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TemplateListQuery): Promise<[ContentTemplate[], number]> {
    const { page, pageSize, scope, search, sort } = query;
    const skip = (page - 1) * pageSize;
    const orderBy = this.buildOrderBy(sort);

    return withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();

      const where = {
        deletedAt: null,
        ...(scope ? { scope } : {}),
        ...(search
          ? {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        // Show platform templates (tenantId IS NULL) OR own tenant templates
        OR: [{ tenantId: null }, { tenantId }],
      };

      const [items, total] = await Promise.all([
        tx.contentTemplate.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
        }),
        tx.contentTemplate.count({ where }),
      ]);

      return [items, total] as [ContentTemplate[], number];
    });
  }

  async findById(id: string): Promise<ContentTemplate | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();
      return tx.contentTemplate.findFirst({
        where: {
          id,
          deletedAt: null,
          OR: [{ tenantId: null }, { tenantId }],
        },
      });
    });
  }

  async findByIdForMaterialization(id: string): Promise<ContentTemplate | null> {
    // No deletedAt filter — caller decides how to handle deleted templates
    return withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();
      return tx.contentTemplate.findFirst({
        where: {
          id,
          OR: [{ tenantId: null }, { tenantId }],
        },
      });
    });
  }

  async findVersionsBySourceTrailId(sourceTrailId: string): Promise<ContentTemplate[]> {
    return withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();
      return tx.contentTemplate.findMany({
        where: {
          sourceTrailId,
          OR: [{ tenantId: null }, { tenantId }],
        },
        orderBy: { version: 'asc' },
      });
    });
  }

  async create(input: CreateTemplateInput): Promise<ContentTemplate> {
    const { userId } = getRequestContext();

    return withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();

      // Calculate next version for this source trail (if provided)
      let version = 1;
      if (input.sourceTrailId) {
        const maxResult = await tx.contentTemplate.aggregate({
          where: { sourceTrailId: input.sourceTrailId },
          _max: { version: true },
        });
        version = (maxResult._max.version ?? 0) + 1;
      }

      return tx.contentTemplate.create({
        data: {
          id: uuidv7(),
          tenantId,
          scope: 'tenant',
          sourceTrailId: input.sourceTrailId ?? null,
          name: input.name,
          description: input.description ?? null,
          version,
          structure: input.structure as object,
          createdBy: userId as string,
        },
      });
    });
  }

  async update(id: string, data: UpdateTemplateInput): Promise<ContentTemplate | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();
      // Only update if it belongs to this tenant (not platform)
      const existing = await tx.contentTemplate.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) return null;

      return tx.contentTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });
    });
  }

  async softDelete(id: string): Promise<ContentTemplate | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const { tenantId } = getRequestContext();
      const existing = await tx.contentTemplate.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) return null;

      return tx.contentTemplate.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  private buildOrderBy(sort: string): Record<string, 'asc' | 'desc'> {
    const map: Record<string, Record<string, 'asc' | 'desc'>> = {
      name: { name: 'asc' },
      '-name': { name: 'desc' },
      createdAt: { createdAt: 'asc' },
      '-createdAt': { createdAt: 'desc' },
    };
    return map[sort] ?? { name: 'asc' };
  }
}
