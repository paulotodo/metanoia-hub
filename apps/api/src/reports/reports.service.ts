import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  REPORTS_CSV_BOM,
  REPORTS_LARGE_TRAIL_THRESHOLD,
  REPORTS_QUEUE_NAME,
  REPORTS_JOB_TTL_SECONDS,
  type TrailReportQuery,
  type TrailReportParticipant,
  type TrailReportResponse,
  type TrailsSummaryResponse,
  type ReportExportJobPayload,
} from '@metanoia/types';
import { generateId } from '@metanoia/types';
import { BullMqService } from '../bullmq/bullmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { getRequestContext } from '../common/context/request-context';
import { withTenantTx } from '../prisma/with-tenant-tx';
import type { TenantTx } from '../prisma/with-tenant-tx';
import { Role } from '../auth/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const EXPORT_JOB_KEY_PREFIX = 'cache:reports:export-job';

interface TrailReportAggregates {
  avgProgressPercent: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
}

@Injectable()
export class ReportsService implements OnModuleInit {
  private readonly logger = new Logger(ReportsService.name);
  private queue!: Queue;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    this.queue = this.bullMqService.createQueue(REPORTS_QUEUE_NAME);
    this.logger.log('reports queue initialized');
  }

  /**
   * GET /api/v1/reports/trails/:trailId
   *
   * The participant universe is the set of members of groups that have this
   * trail assigned (GroupTrail), scoped by role:
   * - admin_tenant / super_admin: members of all such groups in the tenant
   * - lider: members of such groups where the user is a leader
   *
   * Participants without a TrailProgress row are reported as `not_started`
   * (AC #1: "participants who haven't started"). Aggregated metrics describe
   * the full universe and are independent of the status/date view filters.
   */
  async getTrailReport(
    trailId: string,
    query: TrailReportQuery,
    user: AuthenticatedUser,
  ): Promise<TrailReportResponse> {
    const { tenantId } = getRequestContext();

    return withTenantTx(this.prisma, async (tx) => {
      const trail = await tx.trail.findFirst({
        where: { id: trailId, tenantId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!trail) throw new NotFoundException('Trilha não encontrada');

      const participantUserIds = await this.resolveParticipantUserIds(tx, trailId, tenantId, user);
      const allParticipants = await this.buildParticipants(tx, trailId, tenantId, participantUserIds);

      // Aggregates over the full trail universe — independent of view filters.
      const aggregates = this.computeAggregates(allParticipants);

      // Apply view filters (status is a derived field; date range applies to lastActivityAt).
      let filtered = allParticipants;
      if (query.status) {
        filtered = filtered.filter((p) => p.status === query.status);
      }
      if (query.lastActivityAfter) {
        const after = new Date(query.lastActivityAfter).getTime();
        filtered = filtered.filter(
          (p) => p.lastActivityAt !== null && new Date(p.lastActivityAt).getTime() >= after,
        );
      }
      if (query.lastActivityBefore) {
        const before = new Date(query.lastActivityBefore).getTime();
        filtered = filtered.filter(
          (p) => p.lastActivityAt !== null && new Date(p.lastActivityAt).getTime() <= before,
        );
      }

      // Most-recently-active first; never-active (null) participants last.
      filtered.sort((a, b) => {
        const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : -Infinity;
        const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : -Infinity;
        return tb - ta;
      });

      // Pagination reflects the filtered set, so total/totalPages stay consistent.
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / query.perPage));
      const skip = (query.page - 1) * query.perPage;
      const pageData = filtered.slice(skip, skip + query.perPage);

      return {
        data: pageData,
        meta: {
          page: query.page,
          perPage: query.perPage,
          total,
          totalPages,
          trailId,
          trailName: trail.name,
          ...aggregates,
        },
      };
    });
  }

  /**
   * GET /api/v1/reports/trails — admin only.
   * Summary aggregates use the same universe (group members) as the detailed report.
   */
  async getTrailsSummary(): Promise<TrailsSummaryResponse> {
    const { tenantId } = getRequestContext();

    return withTenantTx(this.prisma, async (tx) => {
      const trails = await tx.trail.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, status: true },
        orderBy: { createdAt: 'desc' },
      });

      const results = await Promise.all(
        trails.map(async (trail) => {
          const memberIds = await this.adminTrailMemberIds(tx, trail.id, tenantId);
          const participants = await this.buildParticipants(tx, trail.id, tenantId, memberIds);
          const aggregates = this.computeAggregates(participants);

          return {
            trailId: trail.id,
            trailName: trail.name,
            status: trail.status,
            totalParticipants: participants.length,
            avgProgressPercent: aggregates.avgProgressPercent,
            completedCount: aggregates.completedCount,
            inProgressCount: aggregates.inProgressCount,
            notStartedCount: aggregates.notStartedCount,
          };
        }),
      );

      return { data: results, meta: { total: results.length } };
    });
  }

  /**
   * GET /api/v1/reports/trails/:trailId/export?format=csv
   */
  async exportTrailCsv(
    trailId: string,
    user: AuthenticatedUser,
  ): Promise<{ inline: true; csv: string; filename: string } | { inline: false; jobId: string }> {
    const { tenantId } = getRequestContext();

    const { trail, userIds, participants } = await withTenantTx(this.prisma, async (tx) => {
      const t = await tx.trail.findFirst({
        where: { id: trailId, tenantId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!t) throw new NotFoundException('Trilha não encontrada');

      const ids = await this.resolveParticipantUserIds(tx, trailId, tenantId, user);
      // For the async path the worker rebuilds the rows; avoid the heavy build here.
      const built =
        ids.length > REPORTS_LARGE_TRAIL_THRESHOLD
          ? []
          : await this.buildParticipants(tx, trailId, tenantId, ids);
      return { trail: t, userIds: ids, participants: built };
    });

    if (userIds.length > REPORTS_LARGE_TRAIL_THRESHOLD) {
      const jobId = generateId();
      const payload: ReportExportJobPayload = {
        jobId,
        tenantId,
        trailId,
        trailName: trail.name,
        requestedBy: user.userId,
        userIds,
      };
      await this.queue.add('export-trail-csv', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 50 },
        removeOnFail: false,
      });
      await this.setJobStatus(jobId, 'processing', null, null);
      this.logger.log({ trailId, jobId, participants: userIds.length }, 'export job enqueued');
      return { inline: false, jobId };
    }

    const csv = this.buildCsv(participants);
    const dateStr = new Date().toISOString().split('T')[0] ?? '';
    const safeName = trail.name.replace(/[^a-zA-Z0-9\-_]/g, '_');
    return { inline: true, csv, filename: `trilha-${safeName}-${dateStr}.csv` };
  }

  /**
   * GET /api/v1/reports/jobs/:jobId
   */
  async getJobStatus(jobId: string): Promise<{
    jobId: string;
    status: 'processing' | 'completed' | 'failed';
    signedUrl: string | null;
    expiresAt: string | null;
    failureReason: string | null;
  }> {
    const key = `${EXPORT_JOB_KEY_PREFIX}:${jobId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new NotFoundException('Job não encontrado');
    return JSON.parse(raw) as {
      jobId: string;
      status: 'processing' | 'completed' | 'failed';
      signedUrl: string | null;
      expiresAt: string | null;
      failureReason: string | null;
    };
  }

  // ─── Export processor (called by BullMQ worker) ──────────────────────────

  async processExportJob(payload: ReportExportJobPayload): Promise<void> {
    const { jobId, tenantId, trailId, userIds } = payload;
    try {
      const participants = await withTenantTx(
        this.prisma,
        async (tx) => this.buildParticipants(tx, trailId, tenantId, userIds),
        { tenantId },
      );

      const csv = this.buildCsv(participants);
      const dateStr = new Date().toISOString().split('T')[0] ?? '';
      const objectKey = `exports/trail-${trailId}-${dateStr}-${jobId}.csv`;

      await this.storage.upload(objectKey, Buffer.from(csv, 'utf-8'), 'text/csv; charset=utf-8');
      const signedUrl = await this.storage.getSignedUrl(objectKey, REPORTS_JOB_TTL_SECONDS);
      const expiresAt = new Date(Date.now() + REPORTS_JOB_TTL_SECONDS * 1000).toISOString();

      await this.setJobStatus(jobId, 'completed', signedUrl, expiresAt);
      this.logger.log({ jobId, trailId, rows: participants.length }, 'export job completed');
    } catch (err) {
      await this.setJobStatus(jobId, 'failed', null, null, (err as Error).message);
      this.logger.error({ jobId, trailId, err }, 'export job failed');
      throw err;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Builds participant rows for the given user universe, LEFT-joining trail/module
   * progress so users without progress are reported as `not_started`.
   * Module/lesson totals are derived from THIS trail's modules only.
   */
  private async buildParticipants(
    tx: TenantTx,
    trailId: string,
    tenantId: string,
    userIds: string[],
  ): Promise<TrailReportParticipant[]> {
    if (userIds.length === 0) return [];

    const trailModules = await tx.module.findMany({
      where: { tenantId, trailId, deletedAt: null },
      select: { id: true },
    });
    const trailModuleIds = trailModules.map((m) => m.id);
    const totalModules = trailModuleIds.length;

    const totalLessons =
      trailModuleIds.length > 0
        ? await tx.lesson.count({
            where: { tenantId, moduleId: { in: trailModuleIds }, deletedAt: null },
          })
        : 0;

    const [progresses, users, moduleProgresses] = await Promise.all([
      tx.trailProgress.findMany({
        where: { tenantId, trailId, userId: { in: userIds } },
        select: {
          userId: true,
          progressPercent: true,
          completedModules: true,
          completedAt: true,
          updatedAt: true,
        },
      }),
      tx.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      }),
      trailModuleIds.length > 0
        ? tx.moduleProgress.findMany({
            where: { tenantId, userId: { in: userIds }, moduleId: { in: trailModuleIds } },
            select: { userId: true, completedLessons: true },
          })
        : Promise.resolve([] as { userId: string; completedLessons: number }[]),
    ]);

    const progressByUser = new Map(progresses.map((p) => [p.userId, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    const completedLessonsByUser = new Map<string, number>();
    for (const mp of moduleProgresses) {
      completedLessonsByUser.set(
        mp.userId,
        (completedLessonsByUser.get(mp.userId) ?? 0) + mp.completedLessons,
      );
    }

    return userIds.map((userId) => {
      const u = userMap.get(userId) ?? { id: userId, name: '', email: '' };
      const prog = progressByUser.get(userId);
      const progressPercent = prog?.progressPercent ?? 0;
      const completedAt = prog?.completedAt ?? null;
      return {
        userId,
        name: u.name,
        email: u.email,
        progressPercent,
        completedModules: prog?.completedModules ?? 0,
        totalModules,
        completedLessons: completedLessonsByUser.get(userId) ?? 0,
        totalLessons,
        lastActivityAt: prog?.updatedAt?.toISOString() ?? null,
        status: this.deriveStatus(progressPercent, completedAt),
      };
    });
  }

  private computeAggregates(participants: TrailReportParticipant[]): TrailReportAggregates {
    const totalParticipants = participants.length;
    const avgProgressPercent =
      totalParticipants > 0
        ? Math.round(
            (participants.reduce((s, p) => s + p.progressPercent, 0) / totalParticipants) * 10,
          ) / 10
        : 0;

    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    for (const p of participants) {
      if (p.status === 'completed') completedCount++;
      else if (p.status === 'in_progress') inProgressCount++;
      else notStartedCount++;
    }

    return { avgProgressPercent, completedCount, inProgressCount, notStartedCount };
  }

  /**
   * Resolves the participant universe (group members) for a trail, scoped by role.
   */
  private async resolveParticipantUserIds(
    tx: TenantTx,
    trailId: string,
    tenantId: string,
    user: AuthenticatedUser,
  ): Promise<string[]> {
    const isAdmin =
      user.roles.includes(Role.ADMIN_TENANT) || user.roles.includes(Role.SUPER_ADMIN);

    if (isAdmin) {
      return this.adminTrailMemberIds(tx, trailId, tenantId);
    }

    // Lider: groups where current user is a leader.
    const leaderMemberships = await tx.groupMember.findMany({
      where: { tenantId, userId: user.userId, role: 'lider' },
      select: { groupId: true },
    });
    if (leaderMemberships.length === 0) {
      throw new ForbiddenException('Acesso negado: sem grupos gerenciados');
    }
    const leaderGroupIds = leaderMemberships.map((gm) => gm.groupId);

    const groupTrails = await tx.groupTrail.findMany({
      where: { tenantId, trailId, groupId: { in: leaderGroupIds } },
      select: { groupId: true },
    });
    if (groupTrails.length === 0) return [];

    const relevantGroupIds = groupTrails.map((gt) => gt.groupId);
    const members = await tx.groupMember.findMany({
      where: { tenantId, groupId: { in: relevantGroupIds } },
      select: { userId: true },
    });
    return [...new Set(members.map((m) => m.userId))];
  }

  /**
   * Universe for admins: members of every group in the tenant that has the trail assigned.
   */
  private async adminTrailMemberIds(
    tx: TenantTx,
    trailId: string,
    tenantId: string,
  ): Promise<string[]> {
    const groupTrails = await tx.groupTrail.findMany({
      where: { tenantId, trailId },
      select: { groupId: true },
    });
    if (groupTrails.length === 0) return [];

    const groupIds = groupTrails.map((gt) => gt.groupId);
    const members = await tx.groupMember.findMany({
      where: { tenantId, groupId: { in: groupIds } },
      select: { userId: true },
    });
    return [...new Set(members.map((m) => m.userId))];
  }

  private deriveStatus(
    progressPercent: number,
    completedAt: Date | null,
  ): 'not_started' | 'in_progress' | 'completed' {
    if (completedAt !== null) return 'completed';
    if (progressPercent > 0) return 'in_progress';
    return 'not_started';
  }

  private buildCsv(participants: TrailReportParticipant[]): string {
    const header =
      '"Participante","Progresso (%)","Módulos Concluídos","Aulas Concluídas","Última Atividade","Status"';
    const statusLabel: Record<string, string> = {
      not_started: 'Não iniciado',
      in_progress: 'Em progresso',
      completed: 'Concluído',
    };

    const rows = participants.map((p) => {
      const lastActivity = p.lastActivityAt
        ? new Date(p.lastActivityAt).toLocaleDateString('pt-BR')
        : '';
      const modulesStr = `${p.completedModules}/${p.totalModules}`;
      const lessonsStr = `${p.completedLessons}/${p.totalLessons}`;
      return [
        `"${p.name.replace(/"/g, '""')}"`,
        p.progressPercent,
        `"${modulesStr}"`,
        `"${lessonsStr}"`,
        `"${lastActivity}"`,
        `"${statusLabel[p.status] ?? p.status}"`,
      ].join(',');
    });

    return REPORTS_CSV_BOM + [header, ...rows].join('\r\n');
  }

  private async setJobStatus(
    jobId: string,
    status: 'processing' | 'completed' | 'failed',
    signedUrl: string | null,
    expiresAt: string | null,
    failureReason: string | null = null,
  ): Promise<void> {
    const key = `${EXPORT_JOB_KEY_PREFIX}:${jobId}`;
    const ttl = REPORTS_JOB_TTL_SECONDS + 300;
    const value = JSON.stringify({ jobId, status, signedUrl, expiresAt, failureReason });
    await this.redis.set(key, value, 'EX', ttl);
  }
}
