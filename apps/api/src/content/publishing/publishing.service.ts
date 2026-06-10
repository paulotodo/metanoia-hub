import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import {
  TrailPublishedEventSchema,
  TrailResponseSchema,
  type TrailPublishedEvent,
  type TrailResponse,
} from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { getRequestContext } from '../../common/context/request-context';

@Injectable()
export class PublishingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Publish a trail: status → published, version++, save snapshot in TrailVersion,
   * emit domain event content.trail.published.
   */
  async publishTrail(trailId: string): Promise<{ trail: TrailResponse; event: TrailPublishedEvent }> {
    const ctx = getRequestContext();
    const tenantId = ctx.tenantId as string;
    const userId = ctx.userId as string;

    const trail = await withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.trail.findFirst({
        where: { id: trailId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Trilha não encontrada');
      if (existing.status === 'archived') {
        throw new UnprocessableEntityException('Trilha arquivada não pode ser publicada');
      }

      const nextVersion = (existing.version ?? 0) + 1;
      const publishedAt = new Date();

      // Build snapshot (modules + lessons structure for audit/rollback)
      const modules = await tx.module.findMany({
        where: { trailId, deletedAt: null },
        include: {
          lessons: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        },
        orderBy: { order: 'asc' },
      });

      const snapshot = {
        trailId,
        version: nextVersion,
        name: existing.name,
        description: existing.description,
        accessMode: existing.accessMode,
        modules: modules.map((m) => ({
          id: m.id,
          name: m.name,
          order: m.order,
          lessonAccessMode: m.lessonAccessMode,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            name: l.name,
            contentType: l.contentType,
            order: l.order,
          })),
        })),
        capturedAt: publishedAt.toISOString(),
      };

      // Update trail
      const updated = await tx.trail.update({
        where: { id: trailId },
        data: {
          status: 'published',
          version: nextVersion,
          publishedAt,
          publishedBy: userId,
        },
      });

      // Save version snapshot
      await tx.trailVersion.create({
        data: {
          id: uuidv7(),
          tenantId,
          trailId,
          version: nextVersion,
          snapshotData: snapshot,
          publishedAt,
          publishedBy: userId,
        },
      });

      return updated;
    });

    const trailVersion = trail.version as number;

    const event = TrailPublishedEventSchema.parse({
      eventId: uuidv7(),
      eventType: 'content.trail.published',
      version: 1,
      tenantId,
      timestamp: new Date().toISOString(),
      data: { trailId, trailVersion, publishedBy: userId },
      metadata: { correlationId: uuidv7() },
    });

    const response = TrailResponseSchema.parse({
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

    return { trail: response, event };
  }
}
