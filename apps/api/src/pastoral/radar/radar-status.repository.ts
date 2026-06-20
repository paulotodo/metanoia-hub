import { Injectable } from '@nestjs/common';
import type { RadarStatus, RadarTrend, Prisma } from '@prisma/client';
import { generateId } from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

export interface RadarStatusUpsertData {
  tenantId: string;
  groupId: string;
  participantId: string;
  status: RadarStatus;
  trend: RadarTrend;
  presencePercentage: number;
  lastActiveAt: Date | null;
}

export interface ParticipantRadarStatusRow {
  id: string;
  participantId: string;
  groupId: string;
  status: RadarStatus;
  trend: RadarTrend;
  presencePercentage: Prisma.Decimal; // Prisma Decimal type
  lastActiveAt: Date | null;
  calculatedAt: Date;
}

@Injectable()
export class RadarStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts a single participant's radar status.
   * Uses the unique constraint (tenantId, groupId, participantId) for idempotency.
   */
  async upsert(data: RadarStatusUpsertData): Promise<void> {
    const id = generateId();

    await withTenantTx(this.prisma, (tx) =>
      tx.$executeRaw`
        INSERT INTO participant_radar_status
          (id, tenant_id, group_id, participant_id, status, trend, presence_percentage, last_active_at, calculated_at)
        VALUES
          (${id}::uuid, ${data.tenantId}::uuid, ${data.groupId}::uuid, ${data.participantId}::uuid,
           ${data.status}::"RadarStatus", ${data.trend}::"RadarTrend",
           ${data.presencePercentage}, ${data.lastActiveAt}, now())
        ON CONFLICT (tenant_id, group_id, participant_id) DO UPDATE
          SET status = EXCLUDED.status,
              trend = EXCLUDED.trend,
              presence_percentage = EXCLUDED.presence_percentage,
              last_active_at = EXCLUDED.last_active_at,
              calculated_at = now()
      `,
    );
  }

  /**
   * Returns all radar statuses for a group.
   * Used as fallback when Redis cache is empty.
   */
  async findByGroup(groupId: string): Promise<ParticipantRadarStatusRow[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.participantRadarStatus.findMany({
        where: { groupId },
        orderBy: { calculatedAt: 'desc' },
      }),
    );
  }

  /**
   * Updates the evasion risk status for a participant in a group.
   * Called by EvasionDetectionService after evaluating risk criteria.
   * NOTE: tenantId may be passed via opts for job boundary context.
   */
  async upsertRisk(
    participantId: string,
    groupId: string,
    patch: {
      status: 'verde' | 'amarelo' | 'vermelho';
      riskReason: string | null;
      manualOverrideAt: Date | null;
    },
    opts: { tenantId?: string } = {},
  ): Promise<void> {
    await withTenantTx(
      this.prisma,
      async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE participant_radar_status
           SET status = $3::text::"RadarStatus",
               risk_reason = $4,
               manual_override_at = $5::timestamptz,
               calculated_at = now()
           WHERE participant_id = $1::uuid
             AND group_id = $2::uuid`,
          participantId,
          groupId,
          patch.status,
          patch.riskReason,
          patch.manualOverrideAt,
        );
      },
      opts,
    );
  }
}
