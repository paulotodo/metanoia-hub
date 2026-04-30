import { Injectable } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type { Invite } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminInvitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    token: string;
    inviteeEmail: string;
    inviteeName: string;
    kind: string;
    role: string;
    groupId: string | null;
    expiresAt: Date;
  }): Promise<Invite> {
    const { tenantId } = getRequestContext();
    return this.prisma.tenant.invite.create({
      data: {
        id: uuidv7(),
        token: input.token,
        tenantId,
        leaderName: input.inviteeName,
        leaderEmail: input.inviteeEmail,
        kind: input.kind,
        inviteeRole: input.role,
        groupId: input.groupId,
        expiresAt: input.expiresAt,
      },
    });
  }

  async listForTenant(): Promise<Invite[]> {
    return this.prisma.tenant.invite.findMany({
      where: {
        kind: { not: 'pre_tenant_signup' },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Invite | null> {
    return this.prisma.tenant.invite.findFirst({ where: { id } });
  }

  async revoke(id: string): Promise<Invite | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    return this.prisma.tenant.invite.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async findActiveByEmail(email: string): Promise<Invite | null> {
    return this.prisma.tenant.invite.findFirst({
      where: {
        leaderEmail: email,
        revokedAt: null,
        usedAt: null,
        expiresAt: { gt: new Date() },
        kind: { not: 'pre_tenant_signup' },
      },
    });
  }
}
