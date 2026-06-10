import { Injectable } from '@nestjs/common';
import type { Lesson, Module, Trail } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

// ---------------------------------------------------------------------------
// Trail inputs
// ---------------------------------------------------------------------------
export interface CreateTrailInput {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  accessMode?: 'sequential' | 'free';
  createdBy: string;
}

export interface UpdateTrailInput {
  name?: string;
  description?: string | null;
  status?: 'draft' | 'published' | 'archived';
  accessMode?: 'sequential' | 'free';
}

// ---------------------------------------------------------------------------
// Module inputs
// ---------------------------------------------------------------------------
export interface CreateModuleInput {
  id: string;
  trailId: string;
  name: string;
  order: number;
  lessonAccessMode?: 'sequential' | 'free';
}

export interface UpdateModuleInput {
  name?: string;
  lessonAccessMode?: 'sequential' | 'free';
}

// ---------------------------------------------------------------------------
// Lesson inputs
// ---------------------------------------------------------------------------
export interface CreateLessonInput {
  id: string;
  moduleId: string;
  trailId: string;
  name: string;
  contentType: 'video' | 'rich_text' | 'pdf_doc' | 'external_link';
  contentUrl: string | null;
  order: number;
  estimatedDurationMinutes: number | null;
}

export interface UpdateLessonInput {
  name?: string;
  contentType?: 'video' | 'rich_text' | 'pdf_doc' | 'external_link';
  contentUrl?: string | null;
  contentBody?: string | null;
  tags?: string[];
  estimatedDurationMinutes?: number | null;
  originalName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedBy?: string | null;
  uploadedAt?: Date | null;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Trail ----

  async createTrail(input: CreateTrailInput): Promise<Trail> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.trail.create({
        data: {
          id: input.id,
          tenantId,
          name: input.name,
          description: input.description,
          status: input.status,
          accessMode: input.accessMode ?? 'free',
          createdBy: input.createdBy,
        },
      }),
    );
  }

  async countTrailsByTenant(status?: 'draft' | 'published' | 'archived'): Promise<number> {
    return withTenantTx(this.prisma, (tx) =>
      tx.trail.count({ where: { deletedAt: null, ...(status ? { status } : {}) } }),
    );
  }

  async listTrails(opts: {
    page: number;
    pageSize: number;
    status?: 'draft' | 'published' | 'archived';
  }): Promise<Trail[]> {
    const { page, pageSize, status } = opts;
    return withTenantTx(this.prisma, (tx) =>
      tx.trail.findMany({
        where: { deletedAt: null, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    );
  }

  async findTrailById(id: string): Promise<Trail | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.trail.findFirst({ where: { id, deletedAt: null } }),
    );
  }

  async updateTrail(id: string, patch: UpdateTrailInput): Promise<Trail | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.trail.findFirst({ where: { id, deletedAt: null } });
      if (!existing) return null;
      return tx.trail.update({ where: { id }, data: patch });
    });
  }

  async softDeleteTrail(id: string): Promise<Trail | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.trail.findFirst({ where: { id, deletedAt: null } });
      if (!existing) return null;
      const now = new Date();
      // Cascade soft-delete: modules
      const modules = await tx.module.findMany({ where: { trailId: id, deletedAt: null } });
      for (const mod of modules) {
        await tx.lesson.updateMany({
          where: { moduleId: mod.id, deletedAt: null },
          data: { deletedAt: now },
        });
      }
      await tx.module.updateMany({
        where: { trailId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      return tx.trail.update({ where: { id }, data: { deletedAt: now } });
    });
  }

  // ---- Module ----

  async createModule(input: CreateModuleInput): Promise<Module> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, async (tx) => {
      // Verify trail belongs to tenant and exists
      const trail = await tx.trail.findFirst({
        where: { id: input.trailId, deletedAt: null },
      });
      if (!trail) return Promise.reject(new Error('TRAIL_NOT_FOUND'));
      return tx.module.create({
        data: {
          id: input.id,
          tenantId,
          trailId: input.trailId,
          name: input.name,
          order: input.order,
          lessonAccessMode: input.lessonAccessMode ?? 'free',
        },
      });
    });
  }

  async countModulesByTrail(trailId: string): Promise<number> {
    return withTenantTx(this.prisma, (tx) =>
      tx.module.count({ where: { trailId, deletedAt: null } }),
    );
  }

  async listModules(trailId: string): Promise<Module[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.module.findMany({
        where: { trailId, deletedAt: null },
        orderBy: { order: 'asc' },
      }),
    );
  }

  async findModuleById(id: string, trailId: string): Promise<Module | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.module.findFirst({ where: { id, trailId, deletedAt: null } }),
    );
  }

  async updateModule(id: string, trailId: string, patch: UpdateModuleInput): Promise<Module | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.module.findFirst({ where: { id, trailId, deletedAt: null } });
      if (!existing) return null;
      return tx.module.update({ where: { id }, data: patch });
    });
  }

  async softDeleteModule(id: string, trailId: string): Promise<Module | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.module.findFirst({ where: { id, trailId, deletedAt: null } });
      if (!existing) return null;
      const now = new Date();
      await tx.lesson.updateMany({
        where: { moduleId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      return tx.module.update({ where: { id }, data: { deletedAt: now } });
    });
  }

  async reorderModules(trailId: string, moduleIds: string[]): Promise<Module[]> {
    return withTenantTx(this.prisma, async (tx) => {
      // Validate: no duplicates
      const unique = new Set(moduleIds);
      if (unique.size !== moduleIds.length) {
        return Promise.reject(new Error('REORDER_DUPLICATE_IDS'));
      }
      // Validate: all IDs belong to this trail
      const existing = await tx.module.findMany({
        where: { trailId, deletedAt: null },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((m) => m.id));
      if (moduleIds.length !== existingIds.size) {
        return Promise.reject(new Error('REORDER_COUNT_MISMATCH'));
      }
      for (const mid of moduleIds) {
        if (!existingIds.has(mid)) {
          return Promise.reject(new Error('REORDER_WRONG_PARENT'));
        }
      }
      // Apply new order
      for (let i = 0; i < moduleIds.length; i++) {
        await tx.module.update({ where: { id: moduleIds[i] }, data: { order: i } });
      }
      return tx.module.findMany({
        where: { trailId, deletedAt: null },
        orderBy: { order: 'asc' },
      });
    });
  }

  // ---- Lesson ----

  async createLesson(input: CreateLessonInput): Promise<Lesson> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, async (tx) => {
      const mod = await tx.module.findFirst({
        where: { id: input.moduleId, trailId: input.trailId, deletedAt: null },
      });
      if (!mod) return Promise.reject(new Error('MODULE_NOT_FOUND'));
      return tx.lesson.create({
        data: {
          id: input.id,
          tenantId,
          moduleId: input.moduleId,
          name: input.name,
          contentType: input.contentType,
          contentUrl: input.contentUrl,
          order: input.order,
          estimatedDurationMinutes: input.estimatedDurationMinutes,
        },
      });
    });
  }

  async listLessons(moduleId: string): Promise<Lesson[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.lesson.findMany({
        where: { moduleId, deletedAt: null },
        orderBy: { order: 'asc' },
      }),
    );
  }

  async findLessonById(id: string, moduleId: string): Promise<Lesson | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.lesson.findFirst({ where: { id, moduleId, deletedAt: null } }),
    );
  }

  async updateLesson(id: string, moduleId: string, patch: UpdateLessonInput): Promise<Lesson | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.lesson.findFirst({ where: { id, moduleId, deletedAt: null } });
      if (!existing) return null;
      const { sizeBytes, ...rest } = patch;
      return tx.lesson.update({
        where: { id },
        data: {
          ...rest,
          ...(sizeBytes !== undefined ? { sizeBytes: sizeBytes !== null ? BigInt(sizeBytes) : null } : {}),
        },
      });
    });
  }

  async softDeleteLesson(id: string, moduleId: string): Promise<Lesson | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.lesson.findFirst({ where: { id, moduleId, deletedAt: null } });
      if (!existing) return null;
      return tx.lesson.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  /** Find lesson by id only (without requiring moduleId — for read-path like signed URL) */
  async findLessonByIdOnly(id: string): Promise<Lesson | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.lesson.findFirst({ where: { id, deletedAt: null } }),
    );
  }

  /**
   * Eager-load trail with all modules and lessons in a SINGLE query.
   * Prevents N+1 — modules and lessons are fetched with a single Prisma include.
   */
  async findTrailWithModulesAndLessons(
    trailId: string,
  ): Promise<(Trail & { modules: (import('@prisma/client').Module & { lessons: Lesson[] })[] }) | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.trail.findFirst({
        where: { id: trailId, deletedAt: null },
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
      }),
    ) as Promise<(Trail & { modules: (import('@prisma/client').Module & { lessons: Lesson[] })[] }) | null>;
  }

  async reorderLessons(moduleId: string, lessonIds: string[]): Promise<Lesson[]> {
    return withTenantTx(this.prisma, async (tx) => {
      const unique = new Set(lessonIds);
      if (unique.size !== lessonIds.length) {
        return Promise.reject(new Error('REORDER_DUPLICATE_IDS'));
      }
      const existing = await tx.lesson.findMany({
        where: { moduleId, deletedAt: null },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((l) => l.id));
      if (lessonIds.length !== existingIds.size) {
        return Promise.reject(new Error('REORDER_COUNT_MISMATCH'));
      }
      for (const lid of lessonIds) {
        if (!existingIds.has(lid)) {
          return Promise.reject(new Error('REORDER_WRONG_PARENT'));
        }
      }
      for (let i = 0; i < lessonIds.length; i++) {
        await tx.lesson.update({ where: { id: lessonIds[i] }, data: { order: i } });
      }
      return tx.lesson.findMany({
        where: { moduleId, deletedAt: null },
        orderBy: { order: 'asc' },
      });
    });
  }
}
