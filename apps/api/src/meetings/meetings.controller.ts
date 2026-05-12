import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  CreateMeetingRequestSchema,
  MeetingsListQuerySchema,
  UpdateMeetingRequestSchema,
  type CreateMeetingRequest,
  type MeetingsListQuery,
  type UpdateMeetingRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MeetingsService } from './meetings.service';

@Controller('api/v1/meetings')
@UseGuards(KeycloakAuthGuard, RolesGuard)
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Get()
  @Roles('lider', 'pastor', 'admin', 'admin_tenant')
  async list(
    @Query(new ZodValidationPipe(MeetingsListQuerySchema))
    query: MeetingsListQuery,
  ) {
    return this.service.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('lider', 'admin_tenant')
  async create(
    @Body(new ZodValidationPipe(CreateMeetingRequestSchema))
    body: CreateMeetingRequest,
  ) {
    const data = await this.service.create(body);
    return { data };
  }

  @Get(':meetingId')
  @Roles('lider', 'pastor', 'admin', 'admin_tenant')
  async getDetail(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    const data = await this.service.getDetail(meetingId);
    return { data };
  }

  @Patch(':meetingId')
  @Roles('lider', 'admin_tenant')
  @UsePipes(new ZodValidationPipe(UpdateMeetingRequestSchema))
  async update(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() body: UpdateMeetingRequest,
  ) {
    const data = await this.service.update(meetingId, body);
    return { data };
  }

  @Delete(':meetingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('lider', 'admin_tenant')
  async cancel(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    await this.service.cancel(meetingId);
  }

  @Post(':meetingId/room')
  @HttpCode(HttpStatus.OK)
  @Roles('lider')
  async openRoom(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    const data = await this.service.openRoom(meetingId);
    return { data };
  }

  @Post(':meetingId/room/end')
  @HttpCode(HttpStatus.OK)
  @Roles('lider')
  async endRoom(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    const data = await this.service.endRoom(meetingId);
    return { data };
  }

  // Story 5.1 spec aliases — `/start` and `/end` mirror the existing
  // `/room` and `/room/end` semantics (live ⇄ in_progress, ended ⇄ completed).
  @Post(':meetingId/start')
  @HttpCode(HttpStatus.OK)
  @Roles('lider')
  async start(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    const data = await this.service.openRoom(meetingId);
    return { data };
  }

  @Post(':meetingId/end')
  @HttpCode(HttpStatus.OK)
  @Roles('lider')
  async end(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    const data = await this.service.endRoom(meetingId);
    return { data };
  }

  @Post(':meetingId/join')
  @HttpCode(HttpStatus.OK)
  @Roles('lider', 'pastor', 'admin', 'admin_tenant')
  async join(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    const data = await this.service.join(meetingId);
    return { data };
  }
}
