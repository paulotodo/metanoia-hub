import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ProvisionTenantInputSchema,
  TenantPatchInputSchema,
  TenantsListQuerySchema,
  type ProvisionTenantInput,
  type TenantPatchInput,
  type TenantsListQuery,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SuperAdminTenantsService } from './super-admin-tenants.service';

@Controller('api/v1/admin/super/tenants')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('super_admin')
export class SuperAdminTenantsController {
  constructor(private readonly service: SuperAdminTenantsService) {}

  @Get()
  async list(@Query() rawQuery: Record<string, string>) {
    const parsed = TenantsListQuerySchema.parse({
      page: rawQuery.page ? Number(rawQuery.page) : undefined,
      limit: rawQuery.limit ? Number(rawQuery.limit) : undefined,
      search: rawQuery.search,
      status: rawQuery.status || undefined,
      plan: rawQuery.plan || undefined,
      sortBy: rawQuery.sortBy,
      sortDir: rawQuery.sortDir,
    } as Partial<TenantsListQuery>);
    return this.service.list(parsed);
  }

  @Get(':id')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ZodValidationPipe(ProvisionTenantInputSchema))
  async provision(@Body() body: ProvisionTenantInput) {
    return this.service.provision(body);
  }

  @Get(':id/provision-status')
  async provisionStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getProvisionStatus(id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(TenantPatchInputSchema))
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TenantPatchInput,
  ) {
    return this.service.patch(id, body);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.retry(id);
  }
}
