import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SuperAdminTenantsRepository — read/write queries against the `tenants` table
 * using the non-RLS Prisma client. The Super Admin role operates cross-tenant
 * by design, so we deliberately bypass row-level security here.
 *
 * Privacy boundary (architectural): this repo never returns rows from
 * pastoral tables (radar_signals, care_actions, reflections, group_members
 * with names, etc.). Aggregates use COUNT only.
 */
@Injectable()
export class SuperAdminTenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(args: {
    page: number;
    limit: number;
    status?: string;
    plan?: string;
    search?: string;
    sortBy: string;
    sortDir: 'asc' | 'desc';
  }) {
    const where: Prisma.TenantWhereInput = {};
    if (args.status) where.status = args.status;
    if (args.plan) where.plan = args.plan;
    if (args.search) {
      where.OR = [
        { name: { contains: args.search, mode: 'insensitive' } },
        { slug: { contains: args.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.TenantOrderByWithRelationInput = {
      [args.sortBy]: args.sortDir,
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.tenant.findMany({
        where,
        orderBy,
        skip: (args.page - 1) * args.limit,
        take: args.limit,
      }),
      this.prisma.client.tenant.count({ where }),
    ]);

    const ids = rows.map((r) => r.id);
    const memberCounts =
      ids.length === 0
        ? new Map<string, number>()
        : await this.countMembersByTenant(ids);

    return { rows, total, memberCounts };
  }

  async findById(id: string) {
    return this.prisma.client.tenant.findUnique({ where: { id } });
  }

  async aggregates(id: string): Promise<{
    memberCount: number;
    groupCount: number;
    leaderCount: number;
  }> {
    const [memberCount, groupCount, leaderCount] = await Promise.all([
      this.prisma.client.userTenant.count({ where: { tenantId: id } }),
      this.prisma.client.group.count({ where: { tenantId: id } }),
      this.prisma.client.userTenant.count({
        where: { tenantId: id, role: 'lider' },
      }),
    ]);
    return { memberCount, groupCount, leaderCount };
  }

  async create(input: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    adminEmail: string;
  }) {
    return this.prisma.client.tenant.create({
      data: {
        id: input.id,
        tenantId: input.id, // self-referencing for RLS
        name: input.name,
        slug: input.slug,
        plan: input.plan,
        adminEmail: input.adminEmail,
        status: 'provisioning',
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.client.tenant.update({
      where: { id },
      data: { status },
    });
  }

  async updateName(id: string, name: string) {
    return this.prisma.client.tenant.update({
      where: { id },
      data: { name },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.client.tenant.findUnique({ where: { slug } });
  }

  /**
   * Merges (shallow-patch) the supplied key-value pairs into the tenant's
   * metadata JSONB column. Existing keys not present in `patch` are preserved.
   */
  async updateMetadata(id: string, patch: Record<string, unknown>) {
    // Prisma raw JSON merge — read current value then shallow-merge via update.
    // The DB column default is '{}' so the cast is always safe.
    const current = await this.prisma.client.tenant.findUnique({
      where: { id },
      select: { metadata: true },
    });
    const merged = {
      ...(typeof current?.metadata === 'object' && current.metadata !== null
        ? (current.metadata as Record<string, unknown>)
        : {}),
      ...patch,
    };
    return this.prisma.client.tenant.update({
      where: { id },
      data: { metadata: merged as Prisma.InputJsonValue },
    });
  }

  async setProvisioningState(
    id: string,
    state: { step: number; status: string; failedAt: string | null; error: string | null },
  ) {
    return this.prisma.client.tenant.update({
      where: { id },
      data: { provisioningState: state },
    });
  }

  private async countMembersByTenant(
    ids: string[],
  ): Promise<Map<string, number>> {
    const grouped = await this.prisma.client.userTenant.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: ids } },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const row of grouped) {
      map.set(row.tenantId, row._count._all);
    }
    return map;
  }
}
