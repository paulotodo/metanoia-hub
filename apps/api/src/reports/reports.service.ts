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
  type MeetingReportParticipantFR63,
  computeParticipantEngagement,
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
        kind: 'trail',
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
      await this.setJobStatus(jobId, tenantId, user.userId, 'processing', null, null);
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
    const ctx = getRequestContext();
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;

    // S1 mitigation: tenant-prefixed key (CHK035 — covers both meeting and trail)
    const key = `${EXPORT_JOB_KEY_PREFIX}:${tenantId}:${jobId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new NotFoundException('Job não encontrado');

    const parsed = JSON.parse(raw) as {
      jobId: string;
      status: 'processing' | 'completed' | 'failed';
      signedUrl: string | null;
      expiresAt: string | null;
      failureReason: string | null;
      requesterUserId?: string;
      role?: string;
    };

    // Authorization: only requester or ADMIN_TENANT can read their own job
    // Returns NotFoundException (not 403) to avoid leaking job existence
    const isAdmin = ctx.userId && (parsed.role === 'admin_tenant' || !parsed.requesterUserId);
    if (parsed.requesterUserId && userId !== parsed.requesterUserId && !isAdmin) {
      throw new NotFoundException('Job não encontrado');
    }

    return {
      jobId: parsed.jobId,
      status: parsed.status,
      signedUrl: parsed.signedUrl,
      expiresAt: parsed.expiresAt,
      failureReason: parsed.failureReason,
    };
  }

  /**
   * Enqueue a meeting CSV export job and set initial Redis status.
   * Called from MeetingReportController (POST /api/v1/meetings/:id/report/export).
   */
  async enqueueMeetingExport(
    meetingId: string,
    requesterUserId: string,
    canSeeFull: boolean,
  ): Promise<string> {
    const { tenantId } = getRequestContext();
    const jobId = generateId();
    const payload: ReportExportJobPayload = {
      kind: 'meeting',
      jobId,
      tenantId,
      meetingId,
      requesterUserId,
      canSeeFull,
    };
    await this.queue.add('export-meeting-csv', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 50 },
      removeOnFail: false,
    });
    await this.setJobStatus(jobId, tenantId, requesterUserId, 'processing', null, null);
    this.logger.log({ meetingId, jobId }, 'meeting export job enqueued');
    return jobId;
  }

  // ─── Export processor (called by BullMQ worker) ──────────────────────────

  async processExportJob(
    payload: Extract<ReportExportJobPayload, { kind: 'trail' }>,
  ): Promise<void> {
    const { jobId, tenantId, trailId, userIds, requestedBy } = payload;
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

      await this.setJobStatus(jobId, tenantId, requestedBy, 'completed', signedUrl, expiresAt);
      this.logger.log({ jobId, trailId, rows: participants.length }, 'export job completed');
    } catch (err) {
      await this.setJobStatus(jobId, tenantId, requestedBy, 'failed', null, null, (err as Error).message);
      this.logger.error({ jobId, trailId, err }, 'export job failed');
      throw err;
    }
  }

  /**
   * BullMQ processor — meeting CSV export (FR63, Story 13-1).
   * Mitigação S1: job status stored under tenant-prefixed key.
   */
  async processMeetingExportJob(
    payload: Extract<ReportExportJobPayload, { kind: 'meeting' }>,
  ): Promise<void> {
    const { jobId, tenantId, meetingId, requesterUserId } = payload;

    try {
      // Fetch meeting duration for engagement calculation
      const meeting = await withTenantTx(
        this.prisma,
        (tx) =>
          tx.meeting.findFirst({
            where: { id: meetingId, tenantId, deletedAt: null },
            select: { id: true, durationMinutes: true },
          }),
        { tenantId },
      );
      if (!meeting) throw new NotFoundException('Reunião não encontrada');

      const meetingDurationSeconds = (meeting.durationMinutes ?? 0) * 60;

      // Fetch attendance + users in one transaction
      const rows = await withTenantTx(
        this.prisma,
        async (tx) => {
          const attendance = await tx.meetingAttendance.findMany({
            where: { meetingId, tenantId },
            select: {
              userId: true,
              joinTime: true,
              leaveTime: true,
              totalDurationSeconds: true,
              presenceType: true,
            },
          });
          if (attendance.length === 0) return [];
          const userIds = [...new Set(attendance.map((a) => a.userId))];
          const users = await tx.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          });
          const userMap = new Map(users.map((u) => [u.id, u]));

          // Fetch camera telemetry
          const telemetry = await tx.meetingTelemetry.findMany({
            where: { meetingId, tenantId, userId: { in: userIds } },
            select: { userId: true, cameraOnSeconds: true },
          });
          const telemetryMap = new Map(
            telemetry.map((t) => [t.userId, t.cameraOnSeconds ?? 0]),
          );

          return attendance.map((a) => ({
            userId: a.userId,
            user: userMap.get(a.userId),
            joinedAt: a.joinTime instanceof Date ? a.joinTime.toISOString() : String(a.joinTime),
            leftAt: a.leaveTime instanceof Date ? a.leaveTime.toISOString() : String(a.leaveTime),
            durationSeconds: a.totalDurationSeconds ?? 0,
            cameraSeconds: telemetryMap.get(a.userId) ?? 0,
            presenceType: a.presenceType as string,
          }));
        },
        { tenantId },
      );

      // Build participant rows with engagement
      const participants: MeetingReportParticipantFR63[] = rows.map((r) => {
        const engagement = computeParticipantEngagement(
          r.durationSeconds,
          r.cameraSeconds,
          meetingDurationSeconds,
        );
        const presenceType = r.presenceType as 'integral' | 'parcial' | 'ausente';
        return {
          userId: r.userId,
          name: r.user?.name ?? null,
          email: r.user?.email ?? null,
          status: presenceType,
          joinedAt: r.joinedAt,
          leftAt: r.leftAt,
          durationSeconds: r.durationSeconds,
          engagementScore: engagement?.score ?? null,
          engagementLevel: engagement?.level ?? null,
        };
      });

      const csv = this.buildMeetingCsv(participants);
      const dateStr = new Date().toISOString().split('T')[0] ?? '';
      const objectKey = `exports/meeting-${meetingId}-${dateStr}-${jobId}.csv`;

      await this.storage.upload(objectKey, Buffer.from(csv, 'utf-8'), 'text/csv; charset=utf-8');
      const signedUrl = await this.storage.getSignedUrl(objectKey, REPORTS_JOB_TTL_SECONDS);
      const expiresAt = new Date(Date.now() + REPORTS_JOB_TTL_SECONDS * 1000).toISOString();

      await this.setJobStatus(jobId, tenantId, requesterUserId, 'completed', signedUrl, expiresAt);
      this.logger.log({ jobId, meetingId, rows: participants.length }, 'meeting export job completed');
    } catch (err) {
      await this.setJobStatus(jobId, tenantId, requesterUserId, 'failed', null, null, (err as Error).message);
      this.logger.error({ jobId, meetingId, err }, 'meeting export job failed');
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

  /**
   * Builds CSV for meeting attendance export (FR63, Story 13-1).
   * Columns: Nome, Email, Status, Hora de entrada, Hora de saída, Duração (min), Score de engajamento
   * Encoding: UTF-8 BOM, comma separator, CRLF line endings.
   * Status labels: PT-BR pastoral vocabulary.
   */
  private buildMeetingCsv(participants: MeetingReportParticipantFR63[]): string {
    const header =
      '"Nome","Email","Status","Hora de entrada","Hora de saída","Duração (min)","Score de engajamento"';
    const statusLabel: Record<string, string> = {
      integral: 'Presente',
      parcial: 'Parcial',
      ausente: 'Ausente',
    };
    const rows = participants.map((p) => {
      const entradaStr = p.joinedAt ? new Date(p.joinedAt).toLocaleString('pt-BR') : '';
      const saidaStr = p.leftAt ? new Date(p.leftAt).toLocaleString('pt-BR') : '';
      const duracaoMin = Math.round(p.durationSeconds / 60);
      const scoreStr = p.engagementScore != null ? p.engagementScore.toFixed(2) : '';
      return [
        `"${(p.name ?? '').replace(/"/g, '""')}"`,
        `"${(p.email ?? '').replace(/"/g, '""')}"`,
        `"${statusLabel[p.status] ?? p.status}"`,
        `"${entradaStr}"`,
        `"${saidaStr}"`,
        duracaoMin,
        scoreStr !== '' ? `"${scoreStr}"` : '""',
      ].join(',');
    });
    return REPORTS_CSV_BOM + [header, ...rows].join('\r\n');
  }

  /**
   * Persists export job status in Redis.
   * Key: `cache:reports:export-job:<tenantId>:<jobId>` (S1 mitigation — CHK035).
   * Stores `requesterUserId` for authorization check in `getJobStatus`.
   */
  private async setJobStatus(
    jobId: string,
    tenantId: string,
    requesterUserId: string,
    status: 'processing' | 'completed' | 'failed',
    signedUrl: string | null,
    expiresAt: string | null,
    failureReason: string | null = null,
  ): Promise<void> {
    // S1: tenant-prefixed key — prevents cross-tenant job enumeration (CHK035)
    const key = `${EXPORT_JOB_KEY_PREFIX}:${tenantId}:${jobId}`;
    const ttl = REPORTS_JOB_TTL_SECONDS + 300;
    const value = JSON.stringify({
      jobId,
      status,
      signedUrl,
      expiresAt,
      failureReason,
      requesterUserId,
    });
    await this.redis.set(key, value, 'EX', ttl);
  }
}
