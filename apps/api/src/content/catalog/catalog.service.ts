import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TrailResponseSchema, type TrailResponse } from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import type { Trail } from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /api/v1/trails/:trailId/catalog — mark trail as catalog-visible.
   * Only published trails can be added to the catalog.
   */
  async addToCatalog(trailId: string): Promise<TrailResponse> {
    const trail = await withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.trail.findFirst({
        where: { id: trailId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Trilha não encontrada');
      if (existing.status !== 'published') {
        throw new UnprocessableEntityException(
          'Somente trilhas publicadas podem ser adicionadas ao catálogo',
        );
      }
      return tx.trail.update({
        where: { id: trailId },
        data: { catalogVisible: true },
      });
    });
    return this.toResponse(trail);
  }

  /**
   * DELETE /api/v1/trails/:trailId/catalog — remove trail from catalog.
   */
  async removeFromCatalog(trailId: string): Promise<void> {
    await withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.trail.findFirst({
        where: { id: trailId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Trilha não encontrada');
      await tx.trail.update({
        where: { id: trailId },
        data: { catalogVisible: false },
      });
    });
  }

  /**
   * GET /api/v1/trails/catalog — list published+visible trails for this tenant.
   */
  async listCatalog(): Promise<{ data: TrailResponse[]; meta: { total: number } }> {
    const trails = await withTenantTx(this.prisma, async (tx) => {
      return tx.trail.findMany({
        where: { status: 'published', catalogVisible: true, deletedAt: null },
        orderBy: { publishedAt: 'desc' },
      });
    });
    return {
      data: trails.map((t) => this.toResponse(t)),
      meta: { total: trails.length },
    };
  }

  private toResponse(trail: Trail): TrailResponse {
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
}
