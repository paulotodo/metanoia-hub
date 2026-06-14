import { Injectable, ForbiddenException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp'; // default import — esModuleInterop (D7, CI 8.1.2)
import type { BrandingResponse, UpdateBrandingInput } from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { StorageService } from '../storage/storage.service';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { RedisService } from '../redis/redis.service';

/** Multer file shape (from @nestjs/platform-express / multer). */
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_MIMETYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_MIN_DIM = 64;
const LOGO_MAX_DIM = 512;
/** limitInputPixels guard against decompression bomb attacks (S7) */
const PIXEL_BOMB_LIMIT = LOGO_MAX_DIM * LOGO_MAX_DIM * 4;
const CACHE_TTL_SECONDS = 3600; // 1 hour

function cacheKey(tenantId: string): string {
  return `cache:branding:${tenantId}`;
}

/**
 * BrandingService — manages tenant branding (colors, displayName, logo).
 *
 * Cache strategy: write-through Redis (TTL 1h). DB stores object keys, never
 * signed URLs (CHK023). GET response re-generates signed URLs from the stored
 * object key on cold path.
 *
 * Tier gate: Free tenants may only update displayName; logo/colors are Pro+.
 * CHK033 — concurrent PATCH = last-write-wins intentional; no optimistic lock in MVP.
 */
@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly planLimits: PlanLimitsService,
    private readonly redis: RedisService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // getBranding
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns the branding configuration for the current tenant.
   *
   * logo_url in DB = MinIO object key (NOT signed URL — CHK023; data-model.md §logoUrl).
   * Signed URL is re-generated on cold path and embedded in the Redis-cached response.
   */
  async getBranding(): Promise<BrandingResponse> {
    const { tenantId } = getRequestContext();
    const key = cacheKey(tenantId);

    // 1. Cache hit
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as BrandingResponse;
      }
    } catch {
      // Redis unavailable — continue to DB cold path
    }

    // 2. DB cold path
    const tenant = await withTenantTx(this.prisma, (tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          plan: true,
          logoUrl: true,
          brandPrimaryColor: true,
          brandSecondaryColor: true,
          displayName: true,
        },
      }),
    );

    // Resolve signed URL from object key — NEVER expose raw object key (CHK023)
    let resolvedLogoUrl: string | null = null;
    if (tenant.logoUrl) {
      resolvedLogoUrl = await this.storage.getSignedUrl(tenant.logoUrl, 14400);
    }

    // Build response with explicit field mapping (anti-mass-assignment)
    const response: BrandingResponse = {
      primaryColor: tenant.brandPrimaryColor ?? null,
      secondaryColor: tenant.brandSecondaryColor ?? null,
      displayName: tenant.displayName ?? null,
      logoUrl: resolvedLogoUrl,
      plan: tenant.plan as BrandingResponse['plan'],
      canCustomizeBranding: tenant.plan !== 'free',
    };

    // 3. Write-through Redis (SET, not just DEL — cache write-through rule)
    try {
      await this.redis.set(key, JSON.stringify(response), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Redis write failure is non-fatal
    }

    return response;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // updateBranding
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Updates branding colors and/or display name.
   *
   * CHK033 — concurrent PATCH = last-write-wins intentional; no optimistic lock in MVP.
   *
   * Gate: Free tenants may NOT set primaryColor or secondaryColor.
   *       displayName is always editable (all plans).
   */
  async updateBranding(dto: UpdateBrandingInput): Promise<BrandingResponse> {
    const { tenantId } = getRequestContext();

    // Tier gate — D5: use PlanLimitsService.getPlan(), not PlanLimitsGuard
    const plan = await this.planLimits.getPlan(tenantId);

    if (plan === 'free' && (dto.primaryColor !== undefined || dto.secondaryColor !== undefined)) {
      throw new ForbiddenException(
        'Personalização de cores está disponível nos planos Pro e Enterprise. Faça upgrade para personalizar a identidade visual.',
      );
    }

    await withTenantTx(this.prisma, (tx) =>
      tx.tenant.update({
        where: { id: tenantId },
        data: {
          // Explicit field mapping — anti-mass-assignment (dec-018)
          ...(dto.primaryColor !== undefined && { brandPrimaryColor: dto.primaryColor }),
          ...(dto.secondaryColor !== undefined && { brandSecondaryColor: dto.secondaryColor }),
          ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        },
      }),
    );

    // Re-fetch full response (cache write-through via getBranding cold path)
    // Invalidate first so getBranding hits DB
    const key = cacheKey(tenantId);
    try {
      await this.redis.del(key);
    } catch {
      // non-fatal
    }
    return this.getBranding();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // uploadLogo — [C] security-critical
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Validates, rasterizes, and stores a tenant logo.
   *
   * Security controls:
   *   S2 — object key is server-derived (tenants/{id}/logo-nav.png); file.originalname NOT used.
   *   S6 — SVG always rasterized to PNG (prevents stored-XSS).
   *   S7 — limitInputPixels prevents decompression bomb attacks.
   *
   * logo_url in DB stores the object key (NOT signed URL — CHK023).
   */
  async uploadLogo(file: MulterFile | undefined): Promise<{ logoUrl: string }> {
    const { tenantId } = getRequestContext();

    // Tier gate
    const plan = await this.planLimits.getPlan(tenantId);
    if (plan === 'free') {
      throw new ForbiddenException(
        'Upload de logo está disponível nos planos Pro e Enterprise. Faça upgrade para personalizar a identidade visual.',
      );
    }

    // File presence
    if (!file) {
      throw new BadRequestException('Arquivo não recebido. Envie o logo no campo "file".');
    }

    // Size validation
    if (file.size > MAX_LOGO_BYTES) {
      throw new UnprocessableEntityException(
        'O arquivo de logo excede o tamanho máximo permitido de 2 MB.',
      );
    }

    // MIME type validation
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      throw new UnprocessableEntityException(
        'Formato de arquivo inválido. Envie uma imagem PNG, JPG ou SVG.',
      );
    }

    // Sharp instance with pixel-bomb protection (S7)
    const sharpInstance = sharp(file.buffer, {
      limitInputPixels: PIXEL_BOMB_LIMIT,
      failOn: 'error',
    });

    // Dimension validation for raster formats (SVG has no raster dims before rasterization)
    if (file.mimetype !== 'image/svg+xml') {
      const meta = await sharpInstance.metadata();
      const { width = 0, height = 0 } = meta;
      if (
        width < LOGO_MIN_DIM ||
        width > LOGO_MAX_DIM ||
        height < LOGO_MIN_DIM ||
        height > LOGO_MAX_DIM
      ) {
        throw new UnprocessableEntityException(
          `As dimensões do logo devem estar entre ${LOGO_MIN_DIM}×${LOGO_MIN_DIM} e ${LOGO_MAX_DIM}×${LOGO_MAX_DIM} pixels.`,
        );
      }
    }

    // Rasterize to PNG — S6: SVG always rasterized to prevent stored-XSS
    // S7: limitInputPixels on both calls
    const navBuffer = await sharp(file.buffer, {
      limitInputPixels: PIXEL_BOMB_LIMIT,
      failOn: 'error',
    })
      .resize(128, 128)
      .png()
      .toBuffer();

    const favBuffer = await sharp(file.buffer, {
      limitInputPixels: PIXEL_BOMB_LIMIT,
      failOn: 'error',
    })
      .resize(64, 64)
      .png()
      .toBuffer();

    // Object keys are server-derived — file.originalname NOT used (S2 path traversal)
    const navKey = `tenants/${tenantId}/logo-nav.png`;
    const favKey = `tenants/${tenantId}/logo-fav.png`;

    // Upload both variants
    await this.storage.upload(navKey, navBuffer, 'image/png');
    await this.storage.upload(favKey, favBuffer, 'image/png');

    // Persist object key in DB (NOT signed URL — CHK023)
    await withTenantTx(this.prisma, (tx) =>
      tx.tenant.update({
        where: { id: tenantId },
        data: { logoUrl: navKey },
      }),
    );

    // Generate signed URL for the response only
    const signedUrl = await this.storage.getSignedUrl(navKey, 14400);

    // Invalidate cache so next getBranding cold-paths with new logo
    const key = cacheKey(tenantId);
    try {
      await this.redis.del(key);
    } catch {
      // non-fatal
    }
    // Write-through Redis with updated branding response
    await this.getBranding();

    return { logoUrl: signedUrl };
  }
}
