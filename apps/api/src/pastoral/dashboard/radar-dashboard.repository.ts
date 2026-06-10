import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

export interface GroupStatusRow {
  groupId: string;
  groupName: string;
  verde: number;
  amarelo: number;
  vermelho: number;
  total: number;
}

@Injectable()
export class RadarDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns per-group radar status aggregates for ALL groups in the tenant.
   * Used by admin_tenant role.
   */
  async aggregateByTenant(): Promise<GroupStatusRow[]> {
    return this.rawAggregateByGroups();
  }

  /**
   * Returns per-group radar status aggregates filtered to groups where the
   * given userId is a 'lider' member.
   * Used by lider role — server-side privacy guardrail (Story 6-6 AC#2).
   */
  async aggregateByLeader(userId: string): Promise<GroupStatusRow[]> {
    return this.rawAggregateByGroups(userId);
  }

  /**
   * Single private implementation; when `leaderUserId` is provided the
   * query adds a JOIN on group_members to restrict to that leader's groups.
   */
  private async rawAggregateByGroups(
    leaderUserId?: string,
  ): Promise<GroupStatusRow[]> {
    type RawRow = {
      group_id: string;
      group_name: string;
      verde: bigint | number;
      amarelo: bigint | number;
      vermelho: bigint | number;
      total: bigint | number;
    };

    const rows = await withTenantTx(this.prisma, async (tx) => {
      if (leaderUserId) {
        return tx.$queryRaw<RawRow[]>`
          SELECT
            g.id          AS group_id,
            g.name        AS group_name,
            COUNT(*) FILTER (WHERE prs.status = 'verde')    AS verde,
            COUNT(*) FILTER (WHERE prs.status = 'amarelo')  AS amarelo,
            COUNT(*) FILTER (WHERE prs.status = 'vermelho') AS vermelho,
            COUNT(*)                                         AS total
          FROM groups g
          INNER JOIN group_members gm
            ON gm.group_id = g.id
            AND gm.role = 'lider'
            AND gm.user_id = ${leaderUserId}::uuid
          LEFT JOIN participant_radar_status prs
            ON prs.group_id = g.id
          GROUP BY g.id, g.name
          ORDER BY g.name
        `;
      }

      return tx.$queryRaw<RawRow[]>`
        SELECT
          g.id          AS group_id,
          g.name        AS group_name,
          COUNT(*) FILTER (WHERE prs.status = 'verde')    AS verde,
          COUNT(*) FILTER (WHERE prs.status = 'amarelo')  AS amarelo,
          COUNT(*) FILTER (WHERE prs.status = 'vermelho') AS vermelho,
          COUNT(*)                                         AS total
        FROM groups g
        LEFT JOIN participant_radar_status prs
          ON prs.group_id = g.id
        GROUP BY g.id, g.name
        ORDER BY g.name
      `;
    });

    return rows.map((r) => ({
      groupId: r.group_id,
      groupName: r.group_name,
      verde: Number(r.verde),
      amarelo: Number(r.amarelo),
      vermelho: Number(r.vermelho),
      total: Number(r.total),
    }));
  }
}
