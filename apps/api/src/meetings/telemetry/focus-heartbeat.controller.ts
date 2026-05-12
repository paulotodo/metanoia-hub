import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { FocusHeartbeatSchema, type FocusHeartbeat } from '@metanoia/types';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestContext } from '../../common/context/request-context';
import { TelemetryService } from './telemetry.service';

/**
 * Story 5.4 — focus heartbeat ingestion.
 *
 * Spec calls for WebSocket but the request rate is at most 1 message every
 * 30s per participant. A POST endpoint hits the same NFR (latency budget,
 * privacy gating) without bringing in `@nestjs/websockets` + `socket.io`.
 * The client is expected to fire one POST every 30s while the meeting tab
 * is open AND `tenant.focusIndicatorEnabled` is true AND the transparency
 * banner has been shown (privacy guarantee, AC2).
 */
@Controller('api/v1/meetings')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('lider', 'pastor', 'admin', 'admin_tenant', 'participante')
export class FocusHeartbeatController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post(':meetingId/focus-heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(FocusHeartbeatSchema))
  async heartbeat(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() body: FocusHeartbeat,
  ): Promise<void> {
    const ctx = getRequestContext();
    const userId = ctx.userId;
    if (!userId) return;
    await this.telemetry.recordFocusHeartbeat(
      ctx.tenantId,
      meetingId,
      userId,
      body.visible,
    );
  }
}
