import { Injectable, Logger } from '@nestjs/common';
import {
  type TenantSummaryQuery,
  type TenantSummaryResponse,
  type TenantGroupMetrics,
  type TenantSummaryOverall,
  type TenantSummaryMeta,
  type Semaforo,
} from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

const STALE_THRESHOLD_MINUTES = 20;

interface MvRow {
  group_id: string;
  group_name: string;
  leader_name: string | null;
  attendance_avg_7d: string | null;
  attendance_avg_30d: string | null;
  attendance_avg_90d: string | null;
  trail_progress_avg_7d: string | null;
  risk_count: number;
  active_participants: number;
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? null : n;
}

function computeSemaforo(riskCount: number, activeParticipants: number): Semaforo {
  if (activeParticipants === 0) return 'verde';
  const ratio = riskCount / activeParticipants;
  if (ratio >= 0.5) return 'vermelho';
  if (ratio >= 0.2) return 'amarelo';
  return 'verde';
}

@Injectable()
export class TenantReportService {
  private readonly logger = new Logger(TenantReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTenantSummary(query: TenantSummaryQuery): Promise<TenantSummaryResponse> {
    if (query.period === 'custom') {
      return this.buildCustomPeriodResponse(query);
    }

    return withTenantTx(this.prisma, async (tx) => {
      // Filtro explícito obrigatório — MV não tem RLS (AC-SEC-01/03, dec-009)
      const rows = await tx.$queryRaw<MvRow[]>`
        SELECT
          group_id::text,
          group_name,
          leader_name,
          attendance_avg_7d::text,
          attendance_avg_30d::text,
          attendance_avg_90d::text,
          trail_progress_avg_7d::text,
          risk_count::int,
          active_participants::int
        FROM mv_tenant_report
        WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        ORDER BY group_name ASC
      `;

      const filtered = query.groupId
        ? rows.filter((r) => r.group_id === query.groupId)
        : rows;

      const attendanceField = this.selectAttendanceField(query.period);

      const groups: TenantGroupMetrics[] = filtered.map((r) => {
        const attendanceAvgPercent = toNumber(r[attendanceField as keyof MvRow] as string | null);
        const trailProgressAvgPercent = toNumber(r.trail_progress_avg_7d);
        const riskCount = r.risk_count ?? 0;
        const activeParticipants = r.active_participants ?? 0;
        return {
          groupId: r.group_id,
          groupName: r.group_name,
          leaderName: r.leader_name ?? null,
          attendanceAvgPercent,
          trailProgressAvgPercent,
          riskCount,
          activeParticipants,
          semaforo: computeSemaforo(riskCount, activeParticipants),
        };
      });

      const visibleGroups = query.status
        ? groups.filter((g) => g.semaforo === query.status)
        : groups;

      const summary = this.computeOverall(visibleGroups);
      const lastRefreshAt = await this.getLastRefreshAt();
      const stale = this.isStale(lastRefreshAt);

      const meta: TenantSummaryMeta = {
        period: query.period,
        startDate: null,
        endDate: null,
        lastRefreshAt: lastRefreshAt ? lastRefreshAt.toISOString() : null,
        stale,
        fromMaterializedView: true,
      };

      this.logger.log({ groups: visibleGroups.length }, 'tenant summary served from MV');
      return { data: { groups: visibleGroups, summary }, meta };
    });
  }

  private selectAttendanceField(period: string): string {
    switch (period) {
      case '7d':  return 'attendance_avg_7d';
      case '90d': return 'attendance_avg_90d';
      default:    return 'attendance_avg_30d';
    }
  }

  private computeOverall(groups: TenantGroupMetrics[]): TenantSummaryOverall {
    const totalGroups = groups.length;
    const totalLeaders = groups.filter((g) => g.leaderName !== null).length;
    const totalParticipants = groups.reduce((s, g) => s + g.activeParticipants, 0);
    const totalRiskCount = groups.reduce((s, g) => s + g.riskCount, 0);

    const attendances = groups.map((g) => g.attendanceAvgPercent).filter((v): v is number => v !== null);
    const overallAttendancePercent = attendances.length
      ? attendances.reduce((s, v) => s + v, 0) / attendances.length
      : null;

    const trails = groups.map((g) => g.trailProgressAvgPercent).filter((v): v is number => v !== null);
    const overallTrailProgressPercent = trails.length
      ? trails.reduce((s, v) => s + v, 0) / trails.length
      : null;

    return {
      totalGroups,
      totalLeaders,
      totalParticipants,
      overallAttendancePercent,
      overallTrailProgressPercent,
      totalRiskCount,
    };
  }

  async getLastRefreshAt(): Promise<Date | null> {
    const row = await this.prisma.client.mvRefreshLog.findFirst({
      where: { mvName: 'mv_tenant_report', status: 'success' },
      orderBy: { refreshedAt: 'desc' },
      select: { refreshedAt: true },
    });
    return row?.refreshedAt ?? null;
  }

  private isStale(lastRefreshAt: Date | null): boolean {
    if (!lastRefreshAt) return true;
    const ageMs = Date.now() - lastRefreshAt.getTime();
    return ageMs > STALE_THRESHOLD_MINUTES * 60 * 1_000;
  }

  private async buildCustomPeriodResponse(query: TenantSummaryQuery): Promise<TenantSummaryResponse> {
    const lastRefreshAt = await this.getLastRefreshAt();
    return {
      data: {
        groups: [],
        summary: {
          totalGroups: 0,
          totalLeaders: 0,
          totalParticipants: 0,
          overallAttendancePercent: null,
          overallTrailProgressPercent: null,
          totalRiskCount: 0,
        },
      },
      meta: {
        period: query.period,
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
        lastRefreshAt: lastRefreshAt?.toISOString() ?? null,
        stale: false,
        fromMaterializedView: false,
      },
    };
  }
}
