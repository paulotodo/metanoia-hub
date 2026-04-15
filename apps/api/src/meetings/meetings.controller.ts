import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MeetingsService } from './meetings.service';

@Controller('api/v1/meetings')
@UseGuards(KeycloakAuthGuard, RolesGuard)
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Get(':meetingId')
  @Roles('lider', 'pastor', 'admin')
  async getDetail(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    const data = await this.service.getDetail(meetingId);
    return { data };
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
}
