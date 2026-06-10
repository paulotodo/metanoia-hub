import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  UpdateTenantContentConfigSchema,
  type UpdateTenantContentConfigRequest,
  type TenantContentConfigResponse,
} from '@metanoia/types';
import { ContentConfigService } from './content-config.service';

/**
 * GET /api/v1/tenant-config/content
 * PATCH /api/v1/tenant-config/content
 *
 * Admin Tenant only. Read or update completion rule configuration.
 * Convention over configuration: absent config returns defaults (video=90%, doc=80%).
 */
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT)
@Controller('tenant-config/content')
export class ContentConfigController {
  constructor(private readonly contentConfigService: ContentConfigService) {}

  /**
   * GET /api/v1/tenant-config/content
   * Returns current config or defaults if not yet configured.
   */
  @Get()
  async getConfig(): Promise<TenantContentConfigResponse> {
    return this.contentConfigService.getConfig();
  }

  /**
   * PATCH /api/v1/tenant-config/content
   * Creates or updates tenant content config.
   * Only fields provided in the body are updated; others retain current values.
   */
  @Patch()
  async updateConfig(
    @Body(new ZodValidationPipe(UpdateTenantContentConfigSchema))
    dto: UpdateTenantContentConfigRequest,
  ): Promise<TenantContentConfigResponse> {
    return this.contentConfigService.updateConfig(dto);
  }
}
