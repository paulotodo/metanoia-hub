import { Injectable } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupMembersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findGroupById(groupId: string) {
    return this.prisma.tenant.group.findFirst({ where: { id: groupId } });
  }

  async listByGroup(groupId: string) {
    return this.prisma.tenant.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMembership(groupId: string, userId: string) {
    return this.prisma.tenant.groupMember.findFirst({
      where: { groupId, userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async countByGroup(groupId: string): Promise<number> {
    return this.prisma.tenant.groupMember.count({ where: { groupId } });
  }

  async countLeadersInTenant(): Promise<number> {
    return this.prisma.tenant.groupMember.count({ where: { role: 'lider' } });
  }

  async create(input: { groupId: string; userId: string; role: string }) {
    const { tenantId } = getRequestContext();
    return this.prisma.tenant.groupMember.create({
      data: {
        id: uuidv7(),
        tenantId,
        groupId: input.groupId,
        userId: input.userId,
        role: input.role,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateRole(membershipId: string, role: string) {
    return this.prisma.tenant.groupMember.update({
      where: { id: membershipId },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async delete(membershipId: string) {
    return this.prisma.tenant.groupMember.delete({
      where: { id: membershipId },
    });
  }

  async findUserInTenant(userId: string) {
    return this.prisma.tenant.userTenant.findFirst({ where: { userId } });
  }
}
