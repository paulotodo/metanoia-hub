import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { requestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TenantSelectionService } from './tenant-selection.service';

const USER_ID = '019756d0-0000-7000-8000-00000000aaaa';
const TENANT_A = '019756d0-0001-7000-8000-000000000001';
const TENANT_B = '019756d0-0001-7000-8000-000000000002';

async function withContext<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT_A,
      userId: USER_ID,
      requestId: 'req-1',
      correlationId: 'corr-1',
    },
    fn,
  );
}

describe('TenantSelectionService', () => {
  let service: TenantSelectionService;
  let prisma: {
    client: {
      userTenant: {
        findMany: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
      };
      tenant: { findMany: ReturnType<typeof vi.fn> };
    };
  };
  let redis: { set: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      client: {
        userTenant: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
        },
        tenant: { findMany: vi.fn() },
      },
    };
    redis = { set: vi.fn().mockResolvedValue('OK') };

    const module = await Test.createTestingModule({
      providers: [
        TenantSelectionService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(TenantSelectionService);
  });

  describe('listMyTenants', () => {
    it('returns empty array when user has no memberships', async () => {
      prisma.client.userTenant.findMany.mockResolvedValue([]);
      const result = await withContext(() => service.listMyTenants());
      expect(result).toEqual([]);
      expect(prisma.client.tenant.findMany).not.toHaveBeenCalled();
    });

    it('joins memberships with tenant names and maps role', async () => {
      prisma.client.userTenant.findMany.mockResolvedValue([
        {
          userId: USER_ID,
          tenantId: TENANT_A,
          role: 'lider',
          createdAt: new Date('2026-01-01'),
        },
        {
          userId: USER_ID,
          tenantId: TENANT_B,
          role: 'admin_tenant',
          createdAt: new Date('2026-02-01'),
        },
      ]);
      prisma.client.tenant.findMany.mockResolvedValue([
        { id: TENANT_A, name: 'Igreja A' },
        { id: TENANT_B, name: 'Igreja B' },
      ]);

      const result = await withContext(() => service.listMyTenants());

      expect(result).toEqual([
        {
          tenantId: TENANT_A,
          churchName: 'Igreja A',
          userRole: 'leader',
          lastVisit: null,
        },
        {
          tenantId: TENANT_B,
          churchName: 'Igreja B',
          userRole: 'admin_tenant',
          lastVisit: null,
        },
      ]);
    });

    it('filters out memberships whose tenant row is missing', async () => {
      prisma.client.userTenant.findMany.mockResolvedValue([
        { userId: USER_ID, tenantId: TENANT_A, role: 'participante' },
      ]);
      prisma.client.tenant.findMany.mockResolvedValue([]);

      const result = await withContext(() => service.listMyTenants());
      expect(result).toEqual([]);
    });

    it('throws when userId is missing from request context', async () => {
      await expect(
        requestContext.run(
          {
            tenantId: TENANT_A,
            requestId: 'r',
            correlationId: 'c',
          },
          () => service.listMyTenants(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('selectTenant', () => {
    it('persists active tenant in Redis and returns the tenantId on success', async () => {
      prisma.client.userTenant.findUnique.mockResolvedValue({
        userId: USER_ID,
        tenantId: TENANT_B,
        role: 'leader',
      });

      const result = await withContext(() => service.selectTenant(TENANT_B));

      expect(result).toEqual({ tenantId: TENANT_B });
      expect(redis.set).toHaveBeenCalledWith(
        `user:${USER_ID}:active-tenant`,
        TENANT_B,
        'EX',
        expect.any(Number),
      );
    });

    it('throws NotFoundException when user does not belong to the tenant', async () => {
      prisma.client.userTenant.findUnique.mockResolvedValue(null);

      await expect(
        withContext(() => service.selectTenant(TENANT_B)),
      ).rejects.toThrow(NotFoundException);

      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
