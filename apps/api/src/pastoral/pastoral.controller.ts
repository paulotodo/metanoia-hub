import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CareActionRequestSchema } from './dto/care-action.dto';
import type { CareActionRequest } from './dto/care-action.dto';
import { RadarQuerySchema } from './dto/radar-query.dto';
import { PastoralService } from './pastoral.service';

@Controller('api/v1/radar')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('lider', 'pastor')
export class PastoralController {
  constructor(private readonly service: PastoralService) {}

  @Get()
  async getRadarPage(
    @Query(new ZodValidationPipe(RadarQuerySchema)) query: { groupId?: string },
  ) {
    const data = await this.service.getRadarPage(query.groupId);
    return { data };
  }

  @Get(':id')
  async getSignalDetail(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getSignalDetail(id);
    return { data };
  }

  @Get(':id/profile')
  async getParticipantProfile(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getParticipantProfile(id);
    return { data };
  }

  @Post(':id/actions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CareActionRequestSchema))
  async recordCareAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CareActionRequest,
  ) {
    const data = await this.service.recordCareAction(id, body);
    return { data };
  }
}
