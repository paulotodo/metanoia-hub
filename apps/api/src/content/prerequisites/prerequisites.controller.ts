import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  SetPrerequisitesRequestSchema,
  type SetPrerequisitesRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrerequisitesService } from './prerequisites.service';

@Controller('api/v1/trails/:trailId/modules/:moduleId/prerequisites')
@UseGuards(KeycloakAuthGuard, RolesGuard)
export class PrerequisitesController {
  constructor(private readonly service: PrerequisitesService) {}

  /**
   * GET /api/v1/trails/:trailId/modules/:moduleId/prerequisites
   * Returns the list of prerequisite modules for the given module.
   * Accessible by ADMIN_TENANT and LIDER.
   */
  @Get()
  @Roles(Role.ADMIN_TENANT, Role.LIDER)
  async listPrerequisites(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.service.listPrerequisites(trailId, moduleId);
  }

  /**
   * PATCH /api/v1/trails/:trailId/modules/:moduleId/prerequisites
   * Replaces the full prerequisite list for a module (idempotent set).
   * Returns 422 with explanation if circular dependency detected.
   * Only ADMIN_TENANT can configure prerequisites.
   */
  @Patch()
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN_TENANT)
  async setPrerequisites(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body(new ZodValidationPipe(SetPrerequisitesRequestSchema))
    body: SetPrerequisitesRequest,
  ) {
    return this.service.setPrerequisites(trailId, moduleId, body.prerequisiteModuleIds);
  }
}
