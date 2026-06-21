import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { getRequestContext } from '../common/context/request-context';
import { NotificationsQuerySchema, type NotificationsQuery } from '@metanoia/types';
import { NotificationsService } from './notifications.service';

/**
 * NotificationsController — REST endpoints for the authenticated user's
 * notification inbox.
 *
 * All endpoints:
 *  - Require JWT (KeycloakAuthGuard).
 *  - Extract userId from RequestContext — NEVER from query/body (BOLA-safe).
 *  - RLS enforces tenant isolation at the database level.
 *
 * GET  /api/v1/notifications          — paginated inbox with optional status filter
 * PATCH /api/v1/notifications/:id/read — mark a notification as read
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('api/v1/notifications')
@UseGuards(KeycloakAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  async list(
    @Query(new ZodValidationPipe(NotificationsQuerySchema))
    query: NotificationsQuery,
  ) {
    const ctx = getRequestContext();
    // userId from context — BOLA-safe (user can only see their own notifications)
    return this.notificationsService.findByUser(ctx.userId ?? '', query);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread notifications as read for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns count of updated notifications' })
  async markAllRead() {
    const ctx = getRequestContext();
    const updatedCount = await this.notificationsService.markAllAsRead(
      ctx.userId ?? '',
      new Date(),
    );
    return { data: { updatedCount } };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const ctx = getRequestContext();
    // updateStatusForUser includes userId ownership check (404 not 403) to prevent BOLA
    await this.notificationsService.updateStatusForUser(
      id,
      ctx.userId ?? '',
      'read',
      new Date(),
    );
    return { success: true };
  }
}
