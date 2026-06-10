import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { AlertsService } from './alerts.service';
import type { PastoralAlertRow } from './alerts.repository';

function toAlertDto(alert: PastoralAlertRow) {
  return {
    id: alert.id,
    tenantId: alert.tenantId,
    groupId: alert.groupId,
    participantId: alert.participantId,
    previousStatus: alert.previousStatus,
    newStatus: alert.newStatus,
    trend: alert.trend,
    readAt: alert.readAt ? alert.readAt.toISOString() : null,
    dismissedAt: alert.dismissedAt ? alert.dismissedAt.toISOString() : null,
    createdAt: alert.createdAt.toISOString(),
  };
}

@Controller('api/v1')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.LIDER, 'pastor')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  /**
   * GET /api/v1/groups/:groupId/alerts
   * Returns active (not dismissed) transition alerts for the group.
   */
  @Get('groups/:groupId/alerts')
  async getGroupAlerts(
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<{ data: ReturnType<typeof toAlertDto>[] }> {
    const alerts = await this.service.getGroupAlerts(groupId);
    return { data: alerts.map(toAlertDto) };
  }

  /**
   * PATCH /api/v1/alerts/:id/read
   * Marks the alert as read (sets readAt).
   */
  @Patch('alerts/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.markRead(id);
  }

  /**
   * PATCH /api/v1/alerts/:id/dismiss
   * Dismisses the alert (sets dismissedAt).
   */
  @Patch('alerts/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.dismiss(id);
  }
}
