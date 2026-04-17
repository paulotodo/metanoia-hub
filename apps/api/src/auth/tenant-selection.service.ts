import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { UserTenantRole } from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface MyTenantItem {
  tenantId: string;
  churchName: string;
  userRole: UserTenantRole;
  lastVisit: string | null;
}

const ACTIVE_TENANT_TTL_SECONDS = 60 * 60 * 24 * 30;

function mapRole(raw: string): UserTenantRole {
  switch (raw) {
    case 'leader':
    case 'lider':
    case 'líder':
      return 'leader';
    case 'admin_tenant':
    case 'admin':
      return 'admin_tenant';
    case 'participant':
    case 'participante':
    default:
      return 'participant';
  }
}

@Injectable()
export class TenantSelectionService {
  private readonly logger = new Logger(TenantSelectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listMyTenants(): Promise<MyTenantItem[]> {
    const { userId } = getRequestContext();
    if (!userId) {
      throw new ForbiddenException('userId missing from request context');
    }

    const memberships = await this.prisma.client.userTenant.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (memberships.length === 0) return [];

    const tenantIds = memberships.map((m) => m.tenantId);
    const tenants = await this.prisma.client.tenant.findMany({
      where: { id: { in: tenantIds } },
    });
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    return memberships
      .map((m): MyTenantItem | null => {
        const tenant = tenantById.get(m.tenantId);
        if (!tenant) return null;
        return {
          tenantId: m.tenantId,
          churchName: tenant.name,
          userRole: mapRole(m.role),
          lastVisit: null,
        };
      })
      .filter((item): item is MyTenantItem => item !== null);
  }

  async selectTenant(tenantId: string): Promise<{ tenantId: string }> {
    const { userId } = getRequestContext();
    if (!userId) {
      throw new ForbiddenException('userId missing from request context');
    }

    const membership = await this.prisma.client.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });

    if (!membership) {
      throw new NotFoundException(
        'User does not belong to the requested tenant',
      );
    }

    await this.redis.set(
      `user:${userId}:active-tenant`,
      tenantId,
      'EX',
      ACTIVE_TENANT_TTL_SECONDS,
    );

    this.logger.log({ userId, tenantId }, 'active tenant updated');
    return { tenantId };
  }
}
