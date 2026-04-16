import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  CreateOutreachIntentRequestSchema,
  UpdateOutreachIntentRequestSchema,
} from '@metanoia/types';
import type {
  CreateOutreachIntentRequest,
  UpdateOutreachIntentRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminPastoralService } from './admin-pastoral.service';

@Controller('api/v1/admin/church')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('admin_tenant')
export class ChurchController {
  constructor(private readonly service: AdminPastoralService) {}

  @Get('overview')
  async getOverview() {
    return this.service.getChurchOverview();
  }

  @Get('groups/:groupId/timeline')
  async getGroupTimeline(
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.service.getGroupTimeline(groupId);
  }

  @Get('leaders/:leaderId')
  async getLeaderView(
    @Param('leaderId', ParseUUIDPipe) leaderId: string,
  ) {
    return this.service.getLeaderView(leaderId);
  }
}

@Controller('api/v1/admin/outreach-intents')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('admin_tenant')
export class OutreachIntentController {
  constructor(private readonly service: AdminPastoralService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateOutreachIntentRequestSchema))
  async create(@Body() body: CreateOutreachIntentRequest) {
    return this.service.createOutreachIntent(body);
  }

  @Put(':intentId')
  async update(
    @Param('intentId', ParseUUIDPipe) intentId: string,
    @Body(new ZodValidationPipe(UpdateOutreachIntentRequestSchema))
    body: UpdateOutreachIntentRequest,
  ) {
    return this.service.updateOutreachIntent(intentId, body.note);
  }

  @Delete(':intentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('intentId', ParseUUIDPipe) intentId: string) {
    await this.service.deleteOutreachIntent(intentId);
  }
}
