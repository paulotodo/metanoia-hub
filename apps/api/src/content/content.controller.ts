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
} from '@nestjs/common';
import {
  CreateTrailRequestSchema,
  ReorderModulesRequestSchema,
  TrailsListQuerySchema,
  UpdateTrailRequestSchema,
  type CreateTrailRequest,
  type ReorderModulesRequest,
  type TrailsListQuery,
  type UpdateTrailRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ContentService } from './content.service';

@Controller('api/v1/trails')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.LIDER)
export class ContentController {
  constructor(private readonly service: ContentService) {}

  // ---- Trails ----

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN_TENANT)
  async createTrail(
    @Body(new ZodValidationPipe(CreateTrailRequestSchema)) body: CreateTrailRequest,
  ) {
    const data = await this.service.createTrail(body);
    return { data };
  }

  @Get()
  async listTrails(
    @Query(new ZodValidationPipe(TrailsListQuerySchema)) query: TrailsListQuery,
  ) {
    return this.service.listTrails({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
  }

  @Get(':trailId')
  async getTrail(@Param('trailId', ParseUUIDPipe) trailId: string) {
    const data = await this.service.findTrailById(trailId);
    return { data };
  }

  @Patch(':trailId')
  @Roles(Role.ADMIN_TENANT)
  async updateTrail(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Body(new ZodValidationPipe(UpdateTrailRequestSchema)) body: UpdateTrailRequest,
  ) {
    const data = await this.service.updateTrail(trailId, body);
    return { data };
  }

  @Delete(':trailId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN_TENANT)
  async deleteTrail(@Param('trailId', ParseUUIDPipe) trailId: string) {
    await this.service.deleteTrail(trailId);
  }

  // ---- Module reorder (nested under trail) ----

  @Patch(':trailId/modules/reorder')
  @Roles(Role.ADMIN_TENANT)
  async reorderModules(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Body(new ZodValidationPipe(ReorderModulesRequestSchema)) body: ReorderModulesRequest,
  ) {
    return this.service.reorderModules(trailId, body);
  }
}
