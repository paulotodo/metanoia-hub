import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { getRequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { ReportService } from './report.service';

/**
 * Story 5.6 — `GET /api/v1/meetings/:id/report`.
 *
 * Authorization (AC2/AC3):
 * - admin_tenant realm role → always full view
 * - GroupMember{role ∈ lider|admin} of the meeting's group → full view
 * - Otherwise (Participante) → personal view (only their own attendee row)
 */
@Controller('api/v1/meetings')
@UseGuards(KeycloakAuthGuard, RolesGuard)
// TODO: migrate 'pastor'/'admin' to canonical Role enum when defined (Epic 11)
@Roles(Role.LIDER, 'pastor', 'admin', Role.ADMIN_TENANT, Role.PARTICIPANTE)
export class ReportController {
  constructor(
    private readonly reports: ReportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/report')
  async getReport(
    @Param('id', ParseUUIDPipe) meetingId: string,
    @Req() req: Request & { user?: AuthenticatedUser },
  ) {
    const ctx = getRequestContext();
    const userId = ctx.userId;
    if (!userId) throw new ForbiddenException('Missing user identity');

    const user = req.user;
    const realmRoles = user?.roles ?? [];
    const adminShortcut = realmRoles.includes('admin_tenant');
    const canSeeFull = adminShortcut
      ? true
      : await this.userIsLiderOrAdminOfGroup(meetingId, userId);

    const result = await this.reports.findForUser(meetingId, userId, canSeeFull);
    return { data: result.data, meta: { view: result.kind } };
  }

  private async userIsLiderOrAdminOfGroup(
    meetingId: string,
    userId: string,
  ): Promise<boolean> {
    const meeting = await withTenantTx(this.prisma, (tx) =>
      tx.meeting.findUnique({
        where: { id: meetingId },
        select: { groupId: true },
      }),
    );
    if (!meeting) return false;
    const membership = await withTenantTx(this.prisma, (tx) =>
      tx.groupMember.findFirst({
        where: { groupId: meeting.groupId, userId },
        select: { role: true },
      }),
    );
    return !!membership && (membership.role === 'lider' || membership.role === 'admin');
  }
}
