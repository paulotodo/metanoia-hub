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
  UseGuards,
} from '@nestjs/common';
import {
  CreateModuleRequestSchema,
  UpdateModuleRequestSchema,
  type CreateModuleRequest,
  type UpdateModuleRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ContentService } from '../content.service';

@Controller('api/v1/trails/:trailId/modules')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.LIDER)
export class ModuleController {
  constructor(private readonly service: ContentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN_TENANT)
  async createModule(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Body(new ZodValidationPipe(CreateModuleRequestSchema)) body: CreateModuleRequest,
  ) {
    const data = await this.service.createModule(trailId, body);
    return { data };
  }

  @Get()
  async listModules(@Param('trailId', ParseUUIDPipe) trailId: string) {
    return this.service.listModules(trailId);
  }

  @Patch(':moduleId')
  @Roles(Role.ADMIN_TENANT)
  async updateModule(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body(new ZodValidationPipe(UpdateModuleRequestSchema)) body: UpdateModuleRequest,
  ) {
    const data = await this.service.updateModule(trailId, moduleId, body);
    return { data };
  }

  @Delete(':moduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN_TENANT)
  async deleteModule(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    await this.service.deleteModule(trailId, moduleId);
  }
}
