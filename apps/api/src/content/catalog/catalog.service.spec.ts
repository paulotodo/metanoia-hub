import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

vi.mock('../../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(async (_prisma: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    return fn(mockTx);
  }),
}));

const TRAIL_ID = 'dddddddd-dddd-7000-8000-000000000001';
const TENANT_ID = 'aaaaaaaa-aaaa-7000-8000-000000000001';
const CREATED_BY = 'bbbbbbbb-bbbb-7000-8000-000000000001';

const baseTrail = {
  id: TRAIL_ID,
  tenantId: TENANT_ID,
  name: 'Catalog Trail',
  description: null,
  status: 'published' as const,
  accessMode: 'free' as const,
  version: 1,
  publishedAt: new Date('2026-06-15T10:00:00Z'),
  publishedBy: CREATED_BY,
  catalogVisible: false,
  createdBy: CREATED_BY,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};

const mockTx = {
  trail: {
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
};

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService({} as never);
  });

  describe('addToCatalog', () => {
    it('marks published trail as catalog-visible', async () => {
      mockTx.trail.findFirst.mockResolvedValue(baseTrail);
      mockTx.trail.update.mockResolvedValue({ ...baseTrail, catalogVisible: true });

      const result = await service.addToCatalog(TRAIL_ID);

      expect(result.catalogVisible).toBe(true);
      expect(mockTx.trail.update.mock.calls[0][0].data).toEqual({ catalogVisible: true });
    });

    it('throws NotFoundException when trail missing', async () => {
      mockTx.trail.findFirst.mockResolvedValue(null);
      await expect(service.addToCatalog(TRAIL_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException for draft trail', async () => {
      mockTx.trail.findFirst.mockResolvedValue({ ...baseTrail, status: 'draft' });
      await expect(service.addToCatalog(TRAIL_ID)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('removeFromCatalog', () => {
    it('sets catalogVisible to false', async () => {
      mockTx.trail.findFirst.mockResolvedValue({ ...baseTrail, catalogVisible: true });
      mockTx.trail.update.mockResolvedValue({ ...baseTrail, catalogVisible: false });

      await expect(service.removeFromCatalog(TRAIL_ID)).resolves.toBeUndefined();
      expect(mockTx.trail.update.mock.calls[0][0].data).toEqual({ catalogVisible: false });
    });

    it('throws NotFoundException when trail missing', async () => {
      mockTx.trail.findFirst.mockResolvedValue(null);
      await expect(service.removeFromCatalog(TRAIL_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listCatalog', () => {
    it('returns only published + catalogVisible trails', async () => {
      const catalogTrail = { ...baseTrail, catalogVisible: true };
      mockTx.trail.findMany.mockResolvedValue([catalogTrail]);

      const result = await service.listCatalog();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].catalogVisible).toBe(true);
      expect(result.meta.total).toBe(1);
    });

    it('returns empty list when no catalog trails', async () => {
      mockTx.trail.findMany.mockResolvedValue([]);
      const result = await service.listCatalog();
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });
});
