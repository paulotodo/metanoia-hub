import { Injectable } from '@nestjs/common';
import type { Invite } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * InvitesRepository — queries the invites table with the raw (non-RLS) Prisma
 * client. Invite routes are pre-tenant: the token itself is the only identity
 * the caller holds, so RLS cannot gate access here.
 */
@Injectable()
export class InvitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByToken(token: string): Promise<Invite | null> {
    return this.prisma.client.invite.findUnique({ where: { token } });
  }

  async markTermsAccepted(id: string, _termsVersion: string): Promise<void> {
    await this.prisma.client.invite.update({
      where: { id },
      data: { termsAcceptedAt: new Date() },
    });
  }

  async markUsed(id: string, tenantId: string): Promise<void> {
    await this.prisma.client.invite.update({
      where: { id },
      data: { usedAt: new Date(), tenantId },
    });
  }
}
