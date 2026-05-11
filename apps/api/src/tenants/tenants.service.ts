import { Injectable, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine() {
    const { tenantId } = getRequestContext();

    const tenant = await withTenantTx(this.prisma, (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
      }),
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found for the current session.');
    }

    return tenant;
  }
}
