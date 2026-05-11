import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { UserTenantRole } from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
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
    const ctx = getRequestContext();
    const userId = ctx?.userId;
    if (!userId) {
      throw new ForbiddenException('userId missing from request context');
    }

    // FORCE ROW LEVEL SECURITY on `user_tenants` and `tenants` requires
    // `app.current_tenant_id` to be set per-transaction. Without it the
    // membership lookup returns zero rows even when the membership exists.
    // We seed the SQL var from the JWT's tenant_id claim (the user's
    // primary tenant) so the membership for that tenant is visible.
    //
    // Limitation logged as P0 follow-up (Story 7-6): a user with multiple
    // tenants only sees memberships matching their JWT claim. The proper
    // fix is a BYPASSRLS connection or an RLS policy that allows
    // `WHERE user_id = current_setting('app.current_user_id')`.
    //
    // Note: pre-tenant-context paths (when ctx.tenantId is missing) fall
    // through to the raw client because withTenantTx requires a tenantId.
    // This branch keeps the pre-existing behavior for that edge case.
    const result = ctx?.tenantId
      ? await withTenantTx(this.prisma, async (tx) => {
          const memberships = await tx.userTenant.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          });
          if (memberships.length === 0) return { memberships, tenants: [] };
          const tenantIds = memberships.map((m) => m.tenantId);
          const tenants = await tx.tenant.findMany({
            where: { id: { in: tenantIds } },
          });
          return { memberships, tenants };
        })
      : await this.prisma.client.$transaction(async (tx) => {
          const memberships = await tx.userTenant.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          });
          if (memberships.length === 0) return { memberships, tenants: [] };
          const tenantIds = memberships.map((m) => m.tenantId);
          const tenants = await tx.tenant.findMany({
            where: { id: { in: tenantIds } },
          });
          return { memberships, tenants };
        });

    const tenantById = new Map(result.tenants.map((t) => [t.id, t]));
    return result.memberships
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

    // Same RLS workaround as listMyTenants: SET LOCAL the requested tenantId
    // so the FORCE RLS policy on user_tenants can read the membership row.
    // Without this the cast `current_setting(...)::uuid` of '' throws
    // "invalid input syntax for type uuid". opts.tenantId is required here
    // because the JWT's tenant claim does NOT necessarily match the tenant
    // being selected — the user is choosing which tenant to activate.
    const membership = await withTenantTx(
      this.prisma,
      (tx) =>
        tx.userTenant.findUnique({
          where: { userId_tenantId: { userId, tenantId } },
        }),
      { tenantId },
    );

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
