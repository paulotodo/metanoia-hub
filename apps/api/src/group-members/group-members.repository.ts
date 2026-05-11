import { Injectable } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

@Injectable()
export class GroupMembersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findGroupById(groupId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.group.findFirst({ where: { id: groupId } }),
    );
  }

  async listByGroup(groupId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.findMany({
        where: { groupId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async findMembership(groupId: string, userId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.findFirst({
        where: { groupId, userId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    );
  }

  async countByGroup(groupId: string): Promise<number> {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.count({ where: { groupId } }),
    );
  }

  async countLeadersInTenant(): Promise<number> {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.count({ where: { role: 'lider' } }),
    );
  }

  async create(input: { groupId: string; userId: string; role: string }) {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.create({
        data: {
          id: uuidv7(),
          tenantId,
          groupId: input.groupId,
          userId: input.userId,
          role: input.role,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    );
  }

  async updateRole(membershipId: string, role: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.update({
        where: { id: membershipId },
        data: { role },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    );
  }

  async delete(membershipId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.delete({
        where: { id: membershipId },
      }),
    );
  }

  async findUserInTenant(userId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.userTenant.findFirst({ where: { userId } }),
    );
  }
}
