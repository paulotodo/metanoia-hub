import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ScrubPiiInterceptor } from '../common/interceptors/scrub-pii.interceptor';
import { UpdateTenantProfileSchema, UpdateBrandingSchema, UpdatePoliciesSchema } from '@metanoia/types';
import type { UpdatePoliciesDto } from '@metanoia/types';
import type { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TenantsService } from './tenants.service';
import { BrandingService, type MulterFile } from './branding.service';
import { PoliciesService } from './policies.service';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('api/v1/tenants')
@UseGuards(KeycloakAuthGuard)
export class TenantsController {
  constructor(
    private readonly service: TenantsService,
    private readonly brandingService: BrandingService,
    private readonly policiesService: PoliciesService,
  ) {}

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

  // ──────────────────────────────────────────────────────────────────────────
  // Branding endpoints (Story 11-2)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/tenants/me/branding
   *
   * Returns tenant branding configuration (colors, displayName, signed logo URL).
   * Cache hit: Redis cache:branding:{tenantId} (TTL 1h).
   */
  @Get('me/branding')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN_TENANT)
  @ApiOperation({ summary: 'Get tenant branding configuration' })
  async getBranding() {
    return { data: await this.brandingService.getBranding() };
  }

  /**
   * PATCH /api/v1/tenants/me/branding
   *
   * Update branding colors and/or display name.
   * Free tenants: only displayName is editable; colors return 403.
   */
  @Patch('me/branding')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN_TENANT)
  @UsePipes(new ZodValidationPipe(UpdateBrandingSchema))
  @UseInterceptors(ScrubPiiInterceptor)
  @ApiOperation({ summary: 'Update tenant branding (colors + display name)' })
  async updateBranding(@Body() dto: unknown) {
    return { data: await this.brandingService.updateBranding(dto as import('@metanoia/types').UpdateBrandingInput) };
  }

  /**
   * POST /api/v1/tenants/me/branding/logo
   *
   * Upload tenant logo (PNG/JPG/SVG ≤ 2 MB, dims 64–512 px).
   * Resized to 128×128 (nav) and 64×64 (favicon) via sharp.
   * SVG always rasterized to PNG (anti stored-XSS, S6).
   * Free tenants: 403.
   */
  @Post('me/branding/logo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN_TENANT)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload tenant logo (PNG/JPG/SVG ≤2MB)' })
  async uploadLogo(@UploadedFile() file: MulterFile | undefined) {
    return { data: await this.brandingService.uploadLogo(file) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Policies endpoints (Story 11-3)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/tenants/me/policies
   *
   * Returns the current tenant's behavioural policy toggles.
   * Cache: Redis cache:policies:{tenantId} (TTL 1h, write-through on PATCH).
   * Header X-Policy-Version: current version for FE stale-check.
   * ADMIN_TENANT only — super-admin has no /me context (CHK013).
   */
  @Get('me/policies')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN_TENANT)
  @ApiOperation({ summary: 'Get tenant policy toggles (behavioural configuration)' })
  @ApiResponse({ status: 200, description: 'Policy toggles + tier info returned' })
  @ApiResponse({ status: 403, description: 'Insufficient role (requires ADMIN_TENANT)' })
  async getMyPolicies(@Res({ passthrough: true }) res: Response) {
    const result = await this.policiesService.getPolicies();
    res.set('X-Policy-Version', String(result.policyVersion));
    return { data: { policies: result.policies, policyVersion: result.policyVersion, tierInfo: result.tierInfo } };
  }

  /**
   * PATCH /api/v1/tenants/me/policies
   *
   * Partially update tenant policy toggles.
   * Pro-only toggles (focusMonitoring, mandatoryCamera): 403 on Free tier.
   * policyVersion always increments, even on empty body (dec-010/CHK033).
   * Header X-Policy-Version: new version for FE stale-check.
   * ADMIN_TENANT only — super-admin has no /me context (CHK013).
   */
  @Patch('me/policies')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN_TENANT)
  @ApiOperation({ summary: 'Update tenant policy toggles (partial update)' })
  @ApiResponse({ status: 200, description: 'Policies updated; X-Policy-Version header set' })
  @ApiResponse({ status: 403, description: 'Pro-only toggle attempted by Free tenant, or insufficient role' })
  async updateMyPolicies(
    @Body(new ZodValidationPipe(UpdatePoliciesSchema)) dto: UpdatePoliciesDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.policiesService.updatePolicies(dto);
    res.set('X-Policy-Version', String(result.policyVersion));
    return { data: { policies: result.policies, policyVersion: result.policyVersion, tierInfo: result.tierInfo } };
  }
}
