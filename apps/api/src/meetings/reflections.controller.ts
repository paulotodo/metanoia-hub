import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateReflectionInputSchema,
  type CreateReflectionInput,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReflectionsService } from './reflections.service';

@Controller('api/v1/meetings')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.LIDER)
export class ReflectionsController {
  constructor(private readonly service: ReflectionsService) {}

  @Post(':meetingId/reflections')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(CreateReflectionInputSchema))
    body: CreateReflectionInput,
  ) {
    const data = await this.service.create(meetingId, body);
    return { data };
  }
}
