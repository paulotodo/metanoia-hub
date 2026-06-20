import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PlatformTenantsQuerySchema,
  type PlatformTenantsQuery,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { PlatformMetricsService } from './platform-metrics.service';

@Controller('api/v1/admin/platform-metrics')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class PlatformMetricsController {
  constructor(private readonly service: PlatformMetricsService) {}

  /**
   * FR67-04: Retorna agregados globais de plataforma.
   * GET /api/v1/admin/platform-metrics/summary
   */
  @Get('summary')
  async getSummary() {
    return this.service.getSummary();
  }

  /**
   * FR67-05: Retorna lista paginada de tenants com métricas.
   * GET /api/v1/admin/platform-metrics/tenants
   */
  @Get('tenants')
  async getTenants(@Query() rawQuery: Record<string, string>) {
    const parsed = PlatformTenantsQuerySchema.parse({
      page: rawQuery.page ? Number(rawQuery.page) : undefined,
      limit: rawQuery.limit ? Number(rawQuery.limit) : undefined,
      sortBy: rawQuery.sortBy,
      sortOrder: rawQuery.sortOrder,
      plan: rawQuery.plan || undefined,
      status: rawQuery.status || undefined,
    } as Partial<PlatformTenantsQuery>);
    return this.service.getTenants(parsed);
  }

  /**
   * Trigger manual de refresh da mv_platform_metrics.
   * POST /api/v1/admin/platform-metrics/refresh
   * Returns 202 Accepted.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerRefresh() {
    return this.service.triggerRefresh();
  }
}
