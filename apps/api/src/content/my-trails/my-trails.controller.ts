import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import {
  MyTrailsQuerySchema,
  type MyTrailsQuery,
  type MyTrailsResponse,
} from '@metanoia/types';
import { MyTrailsService } from './my-trails.service';

/**
 * GET /api/v1/my-trails
 * Lists published trails assigned to the authenticated participant's groups.
 * Cursor-based pagination for infinite scroll.
 */
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Controller('my-trails')
export class MyTrailsController {
  constructor(private readonly myTrailsService: MyTrailsService) {}

  @Get()
  async listMyTrails(
    @Query(new ZodValidationPipe(MyTrailsQuerySchema)) query: MyTrailsQuery,
  ): Promise<MyTrailsResponse> {
    return this.myTrailsService.listMyTrails(query.cursor, query.limit);
  }
}
