import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AdminUsersRepository — read/write the user_tenants join table for the
 * current tenant. RLS-aware: queries go through `prisma.tenant.*` so the
 * tenant_id from the request context narrows results automatically.
 */
@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers() {
    return this.prisma.tenant.userTenant.findMany({
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMembership(userId: string) {
    return this.prisma.tenant.userTenant.findFirst({
      where: { userId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async updateRole(userId: string, role: string) {
    const membership = await this.findMembership(userId);
    if (!membership) return null;
    return this.prisma.tenant.userTenant.update({
      where: { id: membership.id },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeFromTenant(userId: string) {
    const membership = await this.findMembership(userId);
    if (!membership) return null;
    return this.prisma.tenant.userTenant.delete({
      where: { id: membership.id },
    });
  }

  async countAdminTenants(): Promise<number> {
    return this.prisma.tenant.userTenant.count({
      where: { role: 'admin_tenant' },
    });
  }
}
