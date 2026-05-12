import { Injectable, NotFoundException } from '@nestjs/common';
import type { TenantMeResponse } from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(): Promise<TenantMeResponse> {
    const { tenantId } = getRequestContext();

    const tenant = await withTenantTx(this.prisma, (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
      }),
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found for the current session.');
    }

    return {
      id: tenant.id,
      tenantId: tenant.tenantId,
      name: tenant.name,
      focusIndicatorEnabled: tenant.focusIndicatorEnabled,
      createdAt: tenant.createdAt.toISOString(),
    };
  }
}
