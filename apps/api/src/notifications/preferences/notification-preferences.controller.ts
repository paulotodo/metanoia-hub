import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UpdateNotificationPreferencesSchema } from '@metanoia/types';
import type { UpdateNotificationPreferences, NotificationPreferences } from '@metanoia/types';
import { NotificationPreferencesService } from './notification-preferences.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

/**
 * NotificationPreferencesController — Story 16-1 (FR78)
 *
 * GET  /api/v1/users/me/notification-preferences  — retorna 7×2 preferências com defaults
 * PATCH /api/v1/users/me/notification-preferences — atualiza parcialmente; 422 para líder + pastoral_alert.inApp=false
 *
 * userId sempre do RequestContext (IDOR-safe — NUNCA do path/query/body).
 * RLS enforced via withTenantTx no service.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('api/v1/users/me/notification-preferences')
@UseGuards(KeycloakAuthGuard)
export class NotificationPreferencesController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification preferences for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns 7 types × 2 channels with defaults true' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: NotificationPreferences }> {
    const result = await this.preferencesService.getForCurrentUser(user?.roles ?? []);
    return { data: result };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification preferences for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns updated preferences' })
  @ApiResponse({ status: 400, description: 'Invalid notification type or channel key' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 422, description: 'Leader cannot disable pastoral_alert.inApp' })
  async patch(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateNotificationPreferencesSchema))
    dto: UpdateNotificationPreferences,
  ): Promise<{ data: NotificationPreferences }> {
    const result = await this.preferencesService.patchForCurrentUser(
      user?.roles ?? [],
      dto,
    );
    return { data: result };
  }
}
