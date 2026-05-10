import { Injectable } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type { Invite } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Same SET-LOCAL-inside-$transaction pattern as GroupsRepository — see the
 * doc comment there. Uses prisma.client + explicit transaction to guarantee
 * the SET LOCAL and the actual query run on the same connection.
 */
@Injectable()
export class AdminInvitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async withTenant<T>(
    fn: (tx: Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    const { tenantId } = getRequestContext();
    if (!tenantId) {
      throw new Error('AdminInvitesRepository called without tenant context');
    }
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      return fn(tx);
    });
  }

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
    if (!tenantId) {
      throw new Error('AdminInvitesRepository.create called without tenant context');
    }
    return this.withTenant((tx) =>
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
    return this.withTenant((tx) =>
      tx.invite.findMany({
        where: { kind: { not: 'pre_tenant_signup' } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findById(id: string): Promise<Invite | null> {
    return this.withTenant((tx) => tx.invite.findFirst({ where: { id } }));
  }

  async revoke(id: string): Promise<Invite | null> {
    return this.withTenant(async (tx) => {
      const existing = await tx.invite.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.invite.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    });
  }

  async findActiveByEmail(email: string): Promise<Invite | null> {
    return this.withTenant((tx) =>
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
