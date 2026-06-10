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
  UseGuards,
} from '@nestjs/common';
import {
  AssociateTrailsRequestSchema,
  type AssociateTrailsRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { GroupTrailsService } from './group-trails.service';

@Controller('api/v1/groups/:groupId/trails')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.LIDER)
export class GroupTrailsController {
  constructor(private readonly service: GroupTrailsService) {}

  /**
   * GET /api/v1/groups/:groupId/trails
   * List all trails associated with a group.
   */
  @Get()
  async list(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.service.listTrails(groupId);
  }

  /**
   * POST /api/v1/groups/:groupId/trails
   * Bulk-associate trails. Returns 201 with created records.
   * Returns 422 if any trailId does not exist in the tenant.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async associate(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body(new ZodValidationPipe(AssociateTrailsRequestSchema))
    body: AssociateTrailsRequest,
  ) {
    return this.service.associateTrails(groupId, body.trailIds);
  }

  /**
   * DELETE /api/v1/groups/:groupId/trails/:trailId
   * Remove a trail association. Returns 204 with no body.
   */
  @Delete(':trailId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassign(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('trailId', ParseUUIDPipe) trailId: string,
  ) {
    await this.service.unassignTrail(groupId, trailId);
  }
}
