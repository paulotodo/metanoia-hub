import { Controller, Get, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { TenantsService } from './tenants.service';

@Controller('api/v1/tenants')
@UseGuards(KeycloakAuthGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get('me')
  async me() {
    const data = await this.service.findMine();
    return { data };
  }
}
