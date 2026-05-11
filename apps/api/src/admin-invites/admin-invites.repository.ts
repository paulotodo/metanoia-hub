import { Injectable } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type { Invite } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

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
    return withTenantTx(this.prisma, (tx) =>
      tx.invite.create({
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
      }),
    );
  }

  async listForTenant(): Promise<Invite[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.invite.findMany({
        where: { kind: { not: 'pre_tenant_signup' } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findById(id: string): Promise<Invite | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.invite.findFirst({ where: { id } }),
    );
  }

  async revoke(id: string): Promise<Invite | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.invite.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.invite.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    });
  }

  async findActiveByEmail(email: string): Promise<Invite | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.invite.findFirst({
        where: {
          leaderEmail: email,
          revokedAt: null,
          usedAt: null,
          expiresAt: { gt: new Date() },
          kind: { not: 'pre_tenant_signup' },
        },
      }),
    );
  }
}
