import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

/**
 * AdminUsersRepository — read/write the user_tenants join table for the
 * current tenant. RLS-aware: queries run inside `withTenantTx` so the
 * SET LOCAL app.current_tenant_id and the query share the same Postgres
 * connection (tenant_id resolved from RequestContext via the helper's ALS
 * fallback).
 */
@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers() {
    return withTenantTx(this.prisma, (tx) =>
      tx.userTenant.findMany({
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async findMembership(userId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.userTenant.findFirst({
        where: { userId },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
    );
  }

  async updateRole(userId: string, role: string) {
    return withTenantTx(this.prisma, async (tx) => {
      const membership = await tx.userTenant.findFirst({
        where: { userId },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      if (!membership) return null;
      return tx.userTenant.update({
        where: { id: membership.id },
        data: { role },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
    });
  }

  async removeFromTenant(userId: string) {
    return withTenantTx(this.prisma, async (tx) => {
      const membership = await tx.userTenant.findFirst({ where: { userId } });
      if (!membership) return null;
      return tx.userTenant.delete({
        where: { id: membership.id },
      });
    });
  }

  async countAdminTenants(): Promise<number> {
    return withTenantTx(this.prisma, (tx) =>
      tx.userTenant.count({
        where: { role: 'admin_tenant' },
      }),
    );
  }
}
