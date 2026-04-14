import { Controller, Get, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { TenantMeResponseSchema } from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { TenantsService } from './tenants.service';

@Controller('api/v1/tenants')
@UseGuards(KeycloakAuthGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get('me')
  async me() {
    const tenant = await this.service.findMine();

    const parsed = TenantMeResponseSchema.safeParse({
      id: tenant.id,
      tenantId: tenant.tenantId,
      name: tenant.name,
      createdAt: tenant.createdAt.toISOString(),
    });

    if (!parsed.success) {
      throw new InternalServerErrorException('Tenant response failed schema validation.');
    }

    return { data: parsed.data };
  }
}
