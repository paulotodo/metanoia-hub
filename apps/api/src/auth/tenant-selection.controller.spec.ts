import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { TenantSelectionController } from './tenant-selection.controller';
import { TenantSelectionService } from './tenant-selection.service';

describe('TenantSelectionController', () => {
  let controller: TenantSelectionController;
  let service: {
    listMyTenants: ReturnType<typeof vi.fn>;
    selectTenant: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listMyTenants: vi.fn(),
      selectTenant: vi.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [TenantSelectionController],
      providers: [{ provide: TenantSelectionService, useValue: service }],
    }).compile();

    controller = module.get(TenantSelectionController);
  });

  it('GET my-tenants wraps service result in { data }', async () => {
    const payload = [
      {
        tenantId: '019756d0-0001-7000-8000-000000000001',
        churchName: 'Igreja A',
        userRole: 'leader' as const,
        lastVisit: null,
      },
    ];
    service.listMyTenants.mockResolvedValue(payload);

    const result = await controller.myTenants();
    expect(result).toEqual({ data: payload });
  });

  it('POST select-tenant forwards tenantId to service and wraps response', async () => {
    const tenantId = '019756d0-0001-7000-8000-000000000002';
    service.selectTenant.mockResolvedValue({ tenantId });

    const result = await controller.selectTenant({ tenantId });

    expect(service.selectTenant).toHaveBeenCalledWith(tenantId);
    expect(result).toEqual({ data: { tenantId } });
  });
});
