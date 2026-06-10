import {
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
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { CatalogService } from './catalog.service';

@Controller('api/v1/trails')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT, Role.LIDER)
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  /**
   * GET /api/v1/trails/catalog
   * List catalog-visible published trails for the tenant.
   * Note: route registered before :trailId endpoints to avoid param collision.
   */
  @Get('catalog')
  async listCatalog() {
    return this.service.listCatalog();
  }

  /**
   * POST /api/v1/trails/:trailId/catalog
   * Add a published trail to the tenant catalog.
   */
  @Post(':trailId/catalog')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN_TENANT)
  async addToCatalog(@Param('trailId', ParseUUIDPipe) trailId: string) {
    const data = await this.service.addToCatalog(trailId);
    return { data };
  }

  /**
   * DELETE /api/v1/trails/:trailId/catalog
   * Remove a trail from the tenant catalog.
   */
  @Delete(':trailId/catalog')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN_TENANT)
  async removeFromCatalog(@Param('trailId', ParseUUIDPipe) trailId: string) {
    await this.service.removeFromCatalog(trailId);
  }
}
