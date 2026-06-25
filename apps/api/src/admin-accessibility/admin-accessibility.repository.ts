import { Injectable } from '@nestjs/common';
import { type LessonAccessibilityGap } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestContext } from '../common/context/request-context';

export interface AccessibilityGapsPage {
  items: LessonAccessibilityGap[];
  total: number;
}

@Injectable()
export class AdminAccessibilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLessonsWithMissingAlt(page: number, pageSize: number): Promise<AccessibilityGapsPage> {
    const { tenantId } = getRequestContext();
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where: {
          tenantId,
          hasMissingAltText: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          tenantId: true,
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
      this.prisma.lesson.count({
        where: {
          tenantId,
          hasMissingAltText: true,
          deletedAt: null,
        },
      }),
    ]);

    return {
      items: items.map((l) => ({
        lessonId: l.id,
        lessonName: l.name,
        moduleName: l.module.name,
        trailName: l.module.trail.name,
        tenantId: l.tenantId,
      })),
      total,
    };
  }
}
