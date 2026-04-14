import { Injectable, NotFoundException } from '@nestjs/common';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine() {
    const { tenantId } = getRequestContext();

    const tenant = await this.prisma.tenant.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found for the current session.');
    }

    return tenant;
  }
}
