import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { getRequestContext } from '../../common/context/request-context';
import { generateId } from '@metanoia/types';
import type {
  TenantContentConfig,
  TenantContentConfigResponse,
  UpdateTenantContentConfigRequest,
} from '@metanoia/types';

/** Default values applied when no config exists for a tenant */
const DEFAULTS = {
  videoThresholdPercent: 90,
  docScrollThresholdPercent: 80,
  allowManualVideoCompletion: false,
  allowManualDocCompletion: false,
} as const;

@Injectable()
export class ContentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns current tenant config or synthetic defaults (convention over configuration).
   * If no row exists, returns defaults without creating a row.
   */
  async getConfig(): Promise<TenantContentConfigResponse> {
    const { tenantId } = getRequestContext();

    const config = await withTenantTx(this.prisma, (tx) =>
      tx.tenantContentConfig.findUnique({ where: { tenantId } }),
    );

    const data: TenantContentConfig = config
      ? {
          id: config.id,
          tenantId: config.tenantId,
          videoThresholdPercent: config.videoThresholdPercent,
          docScrollThresholdPercent: config.docScrollThresholdPercent,
          allowManualVideoCompletion: config.allowManualVideoCompletion,
          allowManualDocCompletion: config.allowManualDocCompletion,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
        }
      : {
          id: '',
          tenantId,
          ...DEFAULTS,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        };

    return { data };
  }

  /**
   * Creates or updates tenant content config (upsert).
   * Only provided fields are changed; unset fields keep their current values or defaults.
   */
  async updateConfig(
    dto: UpdateTenantContentConfigRequest,
  ): Promise<TenantContentConfigResponse> {
    const { tenantId } = getRequestContext();

    const config = await withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.tenantContentConfig.findUnique({
        where: { tenantId },
      });

      if (existing) {
        return tx.tenantContentConfig.update({
          where: { id: existing.id },
          data: {
            ...(dto.videoThresholdPercent !== undefined && {
              videoThresholdPercent: dto.videoThresholdPercent,
            }),
            ...(dto.docScrollThresholdPercent !== undefined && {
              docScrollThresholdPercent: dto.docScrollThresholdPercent,
            }),
            ...(dto.allowManualVideoCompletion !== undefined && {
              allowManualVideoCompletion: dto.allowManualVideoCompletion,
            }),
            ...(dto.allowManualDocCompletion !== undefined && {
              allowManualDocCompletion: dto.allowManualDocCompletion,
            }),
          },
        });
      }

      // Create with provided values merged over defaults
      return tx.tenantContentConfig.create({
        data: {
          id: generateId(),
          tenantId,
          videoThresholdPercent:
            dto.videoThresholdPercent ?? DEFAULTS.videoThresholdPercent,
          docScrollThresholdPercent:
            dto.docScrollThresholdPercent ?? DEFAULTS.docScrollThresholdPercent,
          allowManualVideoCompletion:
            dto.allowManualVideoCompletion ?? DEFAULTS.allowManualVideoCompletion,
          allowManualDocCompletion:
            dto.allowManualDocCompletion ?? DEFAULTS.allowManualDocCompletion,
        },
      });
    });

    return {
      data: {
        id: config.id,
        tenantId: config.tenantId,
        videoThresholdPercent: config.videoThresholdPercent,
        docScrollThresholdPercent: config.docScrollThresholdPercent,
        allowManualVideoCompletion: config.allowManualVideoCompletion,
        allowManualDocCompletion: config.allowManualDocCompletion,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      },
    };
  }
}
