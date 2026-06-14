import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation } from '@nestjs/swagger';
import { ScrubPiiInterceptor } from '../common/interceptors/scrub-pii.interceptor';
import { UpdateTenantProfileSchema, UpdateBrandingSchema } from '@metanoia/types';
import type { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TenantsService } from './tenants.service';
import { BrandingService, type MulterFile } from './branding.service';

@Controller('api/v1/tenants')
@UseGuards(KeycloakAuthGuard)
export class TenantsController {
  constructor(
    private readonly service: TenantsService,
    private readonly brandingService: BrandingService,
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
}
