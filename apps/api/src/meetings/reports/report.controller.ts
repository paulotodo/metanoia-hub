import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
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
import { ReportsService } from '../../reports/reports.service';

/**
 * Story 5.6 + FR63 (Story 13-1) — `GET /api/v1/meetings/:id/report`.
 *
 * Authorization (AC2/AC3):
 * - admin_tenant realm role → always full view
 * - GroupMember{role ∈ lider|admin} of the meeting's group → full view (FR63 leader view)
 * - Otherwise (Participante) → personal view (only their own attendee row)
 *
 * POST /api/v1/meetings/:id/report/export — enqueue async CSV export (FR-06).
 * Requires canSeeFull=true (LIDER/ADMIN_TENANT).
 */
@Controller('api/v1/meetings')
@UseGuards(KeycloakAuthGuard, RolesGuard)
// TODO: migrate 'pastor'/'admin' to canonical Role enum when defined (Epic 11)
@Roles(Role.LIDER, 'pastor', 'admin', Role.ADMIN_TENANT, Role.PARTICIPANTE)
export class ReportController {
  constructor(
    private readonly reports: ReportService,
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  /**
   * GET /api/v1/meetings/:id/report
   *
   * Leader/admin → full FR63 view with participant list + metrics + engagement.
   * Participante → personal view (own attendance row only).
   *
   * CHK040: cadência de polling documentada nos contratos.
   */
  @Get(':id/report')
  @HttpCode(HttpStatus.OK)
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

  /**
   * POST /api/v1/meetings/:id/report/export
   *
   * Enqueues an async CSV export job for the meeting report (FR-06).
   * Returns 202 Accepted with jobId.
   * Requires canSeeFull=true — only leaders and admins can export.
   *
   * Poll status via: GET /api/v1/reports/jobs/:jobId (CHK040: min 3s interval)
   */
  @Post(':id/report/export')
  @Roles(Role.LIDER, 'pastor', 'admin', Role.ADMIN_TENANT)
  @HttpCode(HttpStatus.ACCEPTED)
  async exportReport(
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

    if (!canSeeFull) {
      throw new ForbiddenException('Apenas líderes e administradores podem exportar relatórios de reunião');
    }

    // Verify the meeting exists (guard against 404 enqueue)
    const meeting = await withTenantTx(this.prisma, (tx) =>
      tx.meeting.findUnique({
        where: { id: meetingId },
        select: { id: true },
      }),
    );
    if (!meeting) throw new NotFoundException('Reunião não encontrada');

    const jobId = await this.reportsService.enqueueMeetingExport(
      meetingId,
      userId,
      canSeeFull,
    );

    return {
      data: {
        jobId,
        message: 'Exportação em processamento. Consulte o status pelo jobId.',
      },
    };
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
