import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { ParticipantGroupsService } from './participant-groups.service';

@Controller('api/v1/participant/groups')
@UseGuards(KeycloakAuthGuard)
export class ParticipantGroupsController {
  constructor(private readonly service: ParticipantGroupsService) {}

  @Get()
  async list() {
    return this.service.list();
  }

  @Get(':id')
  async detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detail(id);
  }
}
