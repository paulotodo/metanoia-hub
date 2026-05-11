import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type {
  AcceptTermsRequest,
  AcceptTermsResponse,
  CreateAccountRequest,
  CreateAccountResponse,
  InviteResolveResponse,
  InviteStatus,
  InviteValidateResponse,
} from '@metanoia/types';
import type { Invite } from '@prisma/client';
import { InvitesRepository } from './invites.repository';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { KeycloakAdminService } from '../auth/keycloak-admin.service';

type InviteResolution =
  | { status: 'invalid'; invite: null }
  | { status: Exclude<InviteStatus, 'invalid'>; invite: Invite };

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly repository: InvitesRepository,
    private readonly prisma: PrismaService,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  /**
   * GET /api/v1/invites/:token/resolve
   *
   * Returns the discriminated `InviteResolveResponse` shape consumed by the
   * `/convite/[token]` Server Component. The DB invite row encodes `kind` as
   * an admin-side label (`pre_tenant_signup`, `group_member`, ...) which we
   * map to the FE-facing `kind` enum (`admin-tenant`, `participant`,
   * `leader`).
   *
   * Story 7-5 scope: implements only `pre_tenant_signup` and `group_member`.
   * Remaining kinds (`tenant_member`, `tenant_leader`, `group_leader`) fall
   * through to `invalid` until Story 7-7 wires participant/leader shapes for
   * non-group invites — those flows do not exist in MVP UX yet.
   */
  async resolveToken(token: string): Promise<InviteResolveResponse> {
    const invite = await this.repository.findByToken(token);
    if (!invite) {
      return { status: 'invalid', invite: null };
    }
    if (invite.revokedAt !== null) {
      return { status: 'invalid', invite: null };
    }
    if (invite.usedAt !== null) {
      return { status: 'used', invite: null };
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return { status: 'expired', invite: null };
    }

    switch (invite.kind) {
      case 'pre_tenant_signup':
        return {
          status: 'valid',
          invite: {
            kind: 'admin-tenant',
            leader: {
              name: invite.leaderName,
              email: invite.leaderEmail,
            },
            tenant:
              invite.tenantId && invite.churchName
                ? { id: invite.tenantId, name: invite.churchName }
                : null,
          },
        };

      case 'group_member': {
        if (!invite.groupId || !invite.tenantId) {
          return { status: 'invalid', invite: null };
        }
        const groupId = invite.groupId;
        const tenantId = invite.tenantId;
        const data = await withTenantTx(
          this.prisma,
          async (tx) => {
            const group = await tx.group.findFirst({
              where: { id: groupId, tenantId },
              select: { id: true, name: true },
            });
            const tenant = await tx.tenant.findUnique({
              where: { id: tenantId },
              select: { id: true, name: true },
            });
            const leaderMembership = await tx.groupMember.findFirst({
              where: { groupId, role: 'lider' },
              include: { user: { select: { name: true } } },
              orderBy: { createdAt: 'asc' },
            });
            return { group, tenant, leaderMembership };
          },
          { tenantId },
        );

        if (!data.group || !data.tenant) {
          return { status: 'invalid', invite: null };
        }

        const leaderFullName =
          data.leaderMembership?.user.name ?? invite.leaderName;
        const firstName = leaderFullName.split(' ')[0] || leaderFullName;

        return {
          status: 'valid',
          invite: {
            kind: 'participant',
            leader: { firstName, avatarUrl: null },
            tenant: { id: data.tenant.id, name: data.tenant.name },
            group: { id: data.group.id, name: data.group.name },
          },
        };
      }

      default:
        // tenant_member, tenant_leader, group_leader — Story 7-7
        return { status: 'invalid', invite: null };
    }
  }

  async validateToken(token: string): Promise<InviteValidateResponse> {
    const resolved = await this.resolveStatus(token);

    if (resolved.status === 'invalid' || !resolved.invite) {
      return { status: 'invalid', tenant: null };
    }

    const invite = resolved.invite;
    const preview = {
      leader: {
        name: invite.leaderName,
        email: invite.leaderEmail,
      },
      tenant:
        invite.tenantId && invite.churchName
          ? { id: invite.tenantId, name: invite.churchName }
          : null,
    };

    return {
      status: resolved.status,
      leader: preview.leader,
      tenant: preview.tenant,
    };
  }

  async acceptTerms(
    token: string,
    body: AcceptTermsRequest,
  ): Promise<AcceptTermsResponse> {
    const resolved = await this.resolveStatus(token);
    this.assertValid(resolved);

    await this.repository.markTermsAccepted(resolved.invite.id, body.termsVersion);

    return { acceptedAt: new Date().toISOString() };
  }

  async createAccount(
    token: string,
    body: CreateAccountRequest,
  ): Promise<CreateAccountResponse> {
    const resolved = await this.resolveStatus(token);
    this.assertValid(resolved);
    const invite = resolved.invite;

    const tenantId = uuidv7();
    const userId = uuidv7();

    // Step 1 — provision the Keycloak identity with the tenantId attribute
    // baked into the JWT. Errors here (409, 500) surface before we touch the DB.
    await this.keycloakAdmin.createUserForTenant({
      email: body.email,
      name: body.name,
      password: body.password,
      tenantId,
    });

    // Step 2 — persist tenant, user, role, consent, and invite usage atomically.
    await this.prisma.client.$transaction(async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          tenantId,
          name: body.churchName,
        },
      });

      await tx.user.create({
        data: {
          id: userId,
          email: body.email,
          name: body.name,
          status: 'active',
          tenantId,
        },
      });

      await tx.userTenant.create({
        data: {
          id: uuidv7(),
          userId,
          tenantId,
          role: 'admin',
        },
      });

      await tx.consent.create({
        data: {
          id: uuidv7(),
          userId,
          tenantId,
          documentType: 'terms_of_service',
          version: 'invite-accept',
          ipAddress: '0.0.0.0',
          userAgent: 'invite-flow',
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), tenantId },
      });
    });

    // Step 3 — exchange credentials for tokens. authenticateUser uses the
    // Keycloak password grant; if it's unavailable, fail explicitly instead of
    // issuing placeholder tokens that FE would happily persist.
    const tokens = await this.keycloakAdmin.authenticateUser(body.email, body.password);
    if (!tokens) {
      this.logger.error({ email: body.email }, 'authentication failed after account creation');
      throw new BadRequestException(
        'Conta criada, mas não foi possível iniciar sessão automaticamente. Entre novamente com seu e-mail e senha.',
      );
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tenantId,
      userId,
      email: body.email,
    };
  }

  // --- internals ---

  private async resolveStatus(token: string): Promise<InviteResolution> {
    const invite = await this.repository.findByToken(token);
    if (!invite) {
      return { status: 'invalid', invite: null };
    }
    if (invite.usedAt !== null) {
      return { status: 'used', invite };
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return { status: 'expired', invite };
    }
    return { status: 'valid', invite };
  }

  private assertValid(
    resolved: InviteResolution,
  ): asserts resolved is { status: 'valid'; invite: Invite } {
    switch (resolved.status) {
      case 'valid':
        return;
      case 'used':
        throw new BadRequestException(
          'Este convite já foi utilizado. Fale com seu pastor para receber um novo.',
        );
      case 'expired':
        throw new BadRequestException(
          'Este convite expirou. Fale com seu pastor para receber um novo link.',
        );
      case 'invalid':
      default:
        throw new BadRequestException(
          'Convite não encontrado. Confira o link recebido ou fale com seu pastor.',
        );
    }
  }
}
