import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  type AddGroupMemberInput,
  type GroupMemberRole,
  type GroupMemberSummary,
  type GroupMembersListResponse,
  type GroupsExportData,
  type UpdateGroupMemberRoleInput,
} from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { getLimit } from '../common/plan-limits/plan-limits.config';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroupMembersRepository } from './group-members.repository';

interface MembershipRow {
  id: string;
  groupId: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: { id: string; name: string; email: string };
}

@Injectable()
export class GroupMembersService {
  private readonly logger = new Logger(GroupMembersService.name);

  constructor(
    private readonly repo: GroupMembersRepository,
    private readonly planLimits: PlanLimitsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Export group membership data for a user within a tenant.
   * Privileged — uses prisma.client directly (no RLS). Never throws.
   */
  async exportUserData(userId: string, tenantId: string): Promise<GroupsExportData> {
    const rows = await this.prisma.client.groupMember.findMany({
      where: { userId, tenantId },
      include: { group: { select: { name: true } } },
    });

    return {
      memberships: rows.map((r) => ({
        groupId: r.groupId,
        groupName: r.group.name,
        role: r.role,
        joinedAt: r.createdAt.toISOString(),
      })),
    };
  }

  async list(groupId: string): Promise<GroupMembersListResponse> {
    await this.requireGroup(groupId);
    const rows = await this.repo.listByGroup(groupId);
    const data = rows.map((r) => this.toSummary(r));
    const leaderCount = data.filter((m) => m.role === 'lider').length;
    return { data, meta: { total: data.length, leaderCount } };
  }

  async add(
    groupId: string,
    input: AddGroupMemberInput,
  ): Promise<{ data: GroupMemberSummary }> {
    await this.requireGroup(groupId);

    // User must already belong to this tenant (UserTenant row).
    const userInTenant = await this.repo.findUserInTenant(input.userId);
    if (!userInTenant) {
      throw new NotFoundException('User does not belong to this tenant');
    }

    const existing = await this.repo.findMembership(groupId, input.userId);
    if (existing) {
      throw new ConflictException('User is already a member of this group');
    }

    await this.enforceMembersPerGroup(groupId);

    if (input.role === 'lider') {
      await this.enforceLeadersTenantWide();
    }

    const created = await this.repo.create({
      groupId,
      userId: input.userId,
      role: input.role,
    });
    this.logger.log(
      `Member added: user=${input.userId} group=${groupId} role=${input.role}`,
    );
    return { data: this.toSummary(created) };
  }

  async updateRole(
    groupId: string,
    userId: string,
    input: UpdateGroupMemberRoleInput,
  ): Promise<{ data: GroupMemberSummary }> {
    await this.requireGroup(groupId);
    const current = await this.repo.findMembership(groupId, userId);
    if (!current) {
      throw new NotFoundException('Membership not found');
    }
    if (current.role === input.role) {
      return { data: this.toSummary(current) };
    }
    if (input.role === 'lider') {
      await this.enforceLeadersTenantWide();
    }
    const updated = await this.repo.updateRole(current.id, input.role);
    this.logger.log(
      `Member role changed: user=${userId} group=${groupId} ${current.role}→${input.role}`,
    );
    return { data: this.toSummary(updated) };
  }

  async remove(groupId: string, userId: string): Promise<void> {
    await this.requireGroup(groupId);
    const current = await this.repo.findMembership(groupId, userId);
    if (!current) {
      throw new NotFoundException('Membership not found');
    }
    await this.repo.delete(current.id);
    this.logger.log(`Member removed: user=${userId} group=${groupId}`);
  }

  private async requireGroup(groupId: string): Promise<void> {
    const group = await this.repo.findGroupById(groupId);
    if (!group) throw new NotFoundException('Group not found');
  }

  private async enforceMembersPerGroup(groupId: string): Promise<void> {
    const { tenantId } = getRequestContext();
    if (!tenantId) return;
    const plan = await this.planLimits.getPlan(tenantId);
    const limit = getLimit(plan, 'membersPerGroup');
    if (!Number.isFinite(limit)) return;
    const current = await this.repo.countByGroup(groupId);
    if (current >= limit) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'PlanLimitReached',
        message: `Plan ${plan} allows up to ${limit} members per group; current: ${current}.`,
        details: { resource: 'membersPerGroup', plan, current, limit },
      });
    }
  }

  private async enforceLeadersTenantWide(): Promise<void> {
    const { tenantId } = getRequestContext();
    if (!tenantId) return;
    const plan = await this.planLimits.getPlan(tenantId);
    const limit = getLimit(plan, 'leadersPerTenant');
    if (!Number.isFinite(limit)) return;
    const current = await this.repo.countLeadersInTenant();
    if (current >= limit) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'PlanLimitReached',
        message: `Plan ${plan} allows up to ${limit} leaders per tenant; current: ${current}.`,
        details: { resource: 'leadersPerTenant', plan, current, limit },
      });
    }
  }

  /**
   * Soft-delete group_members rows for a user within a tenant (Story 9-2).
   * Idempotent via WHERE deleted_at IS NULL.
   */
  async softDeleteUserData(userId: string, tenantId: string): Promise<void> {
    await this.prisma.client.$executeRaw`
      UPDATE group_members
      SET deleted_at = NOW()
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
    `;
  }

  /**
   * Hard-delete group_members rows for a user within a tenant (Story 9-2).
   * Called inside a prisma.$transaction by the worker.
   */
  async hardDeleteUserData(
    userId: string,
    tenantId: string,
    tx: Parameters<Parameters<typeof this.prisma.client.$transaction>[0]>[0],
  ): Promise<void> {
    await tx.$executeRaw`
      DELETE FROM group_members
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
    `;
  }

  private toSummary(row: MembershipRow): GroupMemberSummary {
    return {
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.role as GroupMemberRole,
      joinedAt: row.createdAt.toISOString(),
    };
  }
}
