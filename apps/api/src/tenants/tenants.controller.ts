import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ScrubPiiInterceptor } from '../common/interceptors/scrub-pii.interceptor';
import { UpdateTenantProfileSchema } from '@metanoia/types';
import type { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
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

  /**
   * PATCH /api/v1/tenants/me
   *
   * Update church profile and persist onboarding wizard progress.
   * Anti-mass-assignment: ZodValidationPipe(UpdateTenantProfileSchema.strict()).
   * RLS-scoped: tenantId resolved from AsyncLocalStorage (never from body/param).
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN_TENANT)
  @UsePipes(new ZodValidationPipe(UpdateTenantProfileSchema))
  @UseInterceptors(ScrubPiiInterceptor)
  @ApiOperation({ summary: 'Update tenant profile and onboarding progress' })
  async updateProfile(@Body() dto: UpdateTenantProfileDto) {
    return this.service.updateProfile(dto);
  }
}
