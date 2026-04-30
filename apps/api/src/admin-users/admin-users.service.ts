import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  type TenantUserRole,
  type TenantUserSummary,
  type TenantUsersListResponse,
  type UpdateTenantUserRoleInput,
} from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { AdminUsersRepository } from './admin-users.repository';

interface MembershipRow {
  userId: string;
  role: string;
  createdAt: Date;
  user: { id: string; email: string; name: string };
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly repo: AdminUsersRepository) {}

  async listMembers(): Promise<TenantUsersListResponse> {
    const rows = await this.repo.listMembers();
    const data = rows.map((r) => this.toSummary(r));
    return { data, meta: { total: data.length } };
  }

  async getMember(userId: string): Promise<{ data: TenantUserSummary }> {
    const row = await this.repo.findMembership(userId);
    if (!row) throw new NotFoundException('User not found in this tenant');
    return { data: this.toSummary(row) };
  }

  async updateRole(
    userId: string,
    input: UpdateTenantUserRoleInput,
  ): Promise<{ data: TenantUserSummary }> {
    const current = await this.repo.findMembership(userId);
    if (!current) throw new NotFoundException('User not found in this tenant');

    // Veto permanente: não permitir auto-rebaixar quando você é o último
    // admin_tenant — protege contra "tenant órfão" sem ninguém para
    // gerenciá-lo.
    const ctx = getRequestContext();
    if (
      current.role === 'admin_tenant' &&
      input.role !== 'admin_tenant' &&
      ctx.userId === userId
    ) {
      const adminCount = await this.repo.countAdminTenants();
      if (adminCount <= 1) {
        throw new ConflictException(
          'Cannot demote the last admin_tenant of this tenant',
        );
      }
    }

    const updated = await this.repo.updateRole(userId, input.role);
    if (!updated) throw new NotFoundException('User not found in this tenant');

    this.logger.log(
      `User ${userId} role changed from ${current.role} to ${input.role} (tenant ${ctx.tenantId})`,
    );

    return { data: this.toSummary(updated) };
  }

  async removeFromTenant(userId: string): Promise<void> {
    const ctx = getRequestContext();
    const current = await this.repo.findMembership(userId);
    if (!current) throw new NotFoundException('User not found in this tenant');

    // Cannot remove yourself if you're the last admin_tenant.
    if (current.role === 'admin_tenant' && ctx.userId === userId) {
      const adminCount = await this.repo.countAdminTenants();
      if (adminCount <= 1) {
        throw new ConflictException(
          'Cannot remove the last admin_tenant of this tenant',
        );
      }
    }

    await this.repo.removeFromTenant(userId);
    this.logger.log(`User ${userId} removed from tenant ${ctx.tenantId}`);
  }

  private toSummary(row: MembershipRow): TenantUserSummary {
    return {
      userId: row.user.id,
      email: row.user.email,
      name: row.user.name,
      role: row.role as TenantUserRole,
      joinedAt: row.createdAt.toISOString(),
    };
  }
}
