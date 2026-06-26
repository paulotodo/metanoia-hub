import { Injectable } from '@nestjs/common';
import type { LessonAccessibilityGap } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

export interface AccessibilityGapsPage {
  items: LessonAccessibilityGap[];
  total: number;
}

@Injectable()
export class AdminAccessibilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLessonsWithMissingAlt(page: number, pageSize: number): Promise<AccessibilityGapsPage> {
    const skip = (page - 1) * pageSize;

    return withTenantTx(this.prisma, async (tx) => {
      const [rawItems, total] = await Promise.all([
        tx.lesson.findMany({
          where: {
            hasMissingAltText: true,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            module: {
              select: {
                name: true,
                trail: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          skip,
          take: pageSize,
        }),
        tx.lesson.count({
          where: {
            hasMissingAltText: true,
            deletedAt: null,
          },
        }),
      ]);

      return {
        items: rawItems.map((l) => ({
          lessonId: l.id,
          lessonName: l.name,
          moduleName: l.module.name,
          trailName: l.module.trail.name,
        })),
        total,
      };
    });
  }
}
