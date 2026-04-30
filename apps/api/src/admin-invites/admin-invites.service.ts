import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Invite } from '@prisma/client';
import {
  type AdminInviteCreateResponse,
  type AdminInviteKind,
  type AdminInviteStatus,
  type AdminInviteSummary,
  type AdminInvitesListResponse,
  type CreateAdminInviteInput,
} from '@metanoia/types';
import { AdminInvitesRepository } from './admin-invites.repository';

const TOKEN_BYTES = 24;

const KIND_TO_ROLE: Record<AdminInviteKind, string> = {
  tenant_member: 'participante',
  tenant_leader: 'lider',
  group_member: 'participante',
  group_leader: 'lider',
};

@Injectable()
export class AdminInvitesService {
  private readonly logger = new Logger(AdminInvitesService.name);

  constructor(
    private readonly repo: AdminInvitesRepository,
    private readonly config: ConfigService,
  ) {}

  async create(
    input: CreateAdminInviteInput,
  ): Promise<AdminInviteCreateResponse> {
    const conflict = await this.repo.findActiveByEmail(input.inviteeEmail);
    if (conflict) {
      throw new ConflictException(
        'A pending invite already exists for this email',
      );
    }

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(
      Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
    );
    const role = KIND_TO_ROLE[input.kind];

    const invite = await this.repo.create({
      token,
      inviteeEmail: input.inviteeEmail,
      inviteeName: input.inviteeName,
      kind: input.kind,
      role,
      groupId: input.groupId ?? null,
      expiresAt,
    });

    const baseUrl =
      this.config.get<string>('FRONTEND_BASE_URL') ?? 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/convite/${token}`;

    // Story 14-3 (Release 2) substitui pelo envio real via Resend.
    this.logger.log(
      `Invite created: kind=${input.kind} email=${input.inviteeEmail} url=${inviteUrl}`,
    );

    return {
      data: {
        invite: this.toSummary(invite),
        inviteUrl,
      },
    };
  }

  async list(): Promise<AdminInvitesListResponse> {
    const rows = await this.repo.listForTenant();
    const data = rows.map((r) => this.toSummary(r));
    return { data, meta: { total: data.length } };
  }

  async revoke(id: string): Promise<{ data: AdminInviteSummary }> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundException('Invite not found');
    if (current.revokedAt) {
      return { data: this.toSummary(current) };
    }
    if (current.usedAt) {
      throw new ConflictException('Cannot revoke an invite that was already used');
    }
    const revoked = await this.repo.revoke(id);
    if (!revoked) throw new NotFoundException('Invite not found');
    this.logger.log(`Invite revoked: id=${id}`);
    return { data: this.toSummary(revoked) };
  }

  private toSummary(row: Invite): AdminInviteSummary {
    return {
      id: row.id,
      inviteeEmail: row.leaderEmail,
      inviteeName: row.leaderName,
      kind: row.kind as AdminInviteKind,
      groupId: row.groupId,
      status: this.statusOf(row),
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private statusOf(row: Invite): AdminInviteStatus {
    if (row.revokedAt) return 'revoked';
    if (row.usedAt) return 'accepted';
    if (row.expiresAt.getTime() < Date.now()) return 'expired';
    return 'pending';
  }
}
