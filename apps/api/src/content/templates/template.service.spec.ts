import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateRepository } from './template.repository';
import type { ContentTemplate as PrismaContentTemplate } from '@prisma/client';

// Mock getRequestContext
vi.mock('../../common/context/request-context', () => ({
  getRequestContext: () => ({ tenantId: 'tenant-uuid-test', userId: 'user-uuid-test' }),
}));

// Mock withTenantTx: executes callback with mock tx
vi.mock('../../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn((_prisma: unknown, cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      trail: { create: vi.fn() },
      module: { create: vi.fn() },
      lesson: { create: vi.fn() },
      groupTrail: { create: vi.fn() },
    };
    return cb(tx);
  }),
}));

const mockRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByIdForMaterialization: vi.fn(),
  findVersionsBySourceTrailId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
} as unknown as TemplateRepository;

const mockPrisma = {
  trail: { findFirst: vi.fn() },
  $transaction: vi.fn(),
} as unknown;

function makePrismaTemplate(overrides: Partial<PrismaContentTemplate> = {}): PrismaContentTemplate {
  return {
    id: 'template-id-1',
    tenantId: 'tenant-uuid-test',
    scope: 'tenant',
    sourceTrailId: null,
    name: 'Test Template',
    description: null,
    version: 1,
    structure: { modules: [] },
    createdBy: 'user-uuid-test',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as PrismaContentTemplate;
}

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateService(mockRepository, mockPrisma as never);
  });

  describe('getTemplateById', () => {
    it('returns template when found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(makePrismaTemplate());
      const result = await service.getTemplateById('template-id-1');
      expect(result.id).toBe('template-id-1');
      expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('throws NotFoundException when not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);
      await expect(service.getTemplateById('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTemplate', () => {
    it('throws ForbiddenException for platform template', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(
        makePrismaTemplate({ scope: 'platform', tenantId: null }),
      );
      await expect(
        service.updateTemplate('template-id-1', { name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when update returns null', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(makePrismaTemplate());
      vi.mocked(mockRepository.update).mockResolvedValue(null);
      await expect(
        service.updateTemplate('template-id-1', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns updated template on success', async () => {
      const updated = makePrismaTemplate({ name: 'Updated Name' });
      vi.mocked(mockRepository.findById).mockResolvedValue(makePrismaTemplate());
      vi.mocked(mockRepository.update).mockResolvedValue(updated);
      const result = await service.updateTemplate('template-id-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteTemplate', () => {
    it('throws ForbiddenException for platform template', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(
        makePrismaTemplate({ scope: 'platform', tenantId: null }),
      );
      await expect(service.deleteTemplate('template-id-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when softDelete returns null', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(makePrismaTemplate());
      vi.mocked(mockRepository.softDelete).mockResolvedValue(null);
      await expect(service.deleteTemplate('template-id-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('materializeTrail', () => {
    it('throws NotFoundException when template not found', async () => {
      vi.mocked(mockRepository.findByIdForMaterialization).mockResolvedValue(null);
      await expect(
        service.materializeTrail('missing-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when template is soft-deleted', async () => {
      vi.mocked(mockRepository.findByIdForMaterialization).mockResolvedValue(
        makePrismaTemplate({ deletedAt: new Date() }),
      );
      await expect(
        service.materializeTrail('deleted-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTemplateVersions', () => {
    it('returns empty data for platform templates', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(
        makePrismaTemplate({ scope: 'platform', tenantId: null }),
      );
      const result = await service.getTemplateVersions('platform-id');
      expect(result.data).toHaveLength(0);
    });
  });

  describe('listTemplates', () => {
    it('returns formatted list with meta', async () => {
      const item = makePrismaTemplate();
      vi.mocked(mockRepository.findAll).mockResolvedValue([[item], 1]);
      const result = await service.listTemplates({ page: 1, pageSize: 20, sort: 'name' });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
