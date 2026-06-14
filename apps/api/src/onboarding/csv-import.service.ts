import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { uuidv7 } from 'uuidv7';
import {
  CSV_IMPORT_QUEUE_NAME,
  type ImportRowInput,
  type ImportResultLine,
  type ImportResultSummary,
} from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { getLimit } from '../common/plan-limits/plan-limits.config';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { GroupMembersRepository } from '../group-members/group-members.repository';
import { AdminInvitesService } from '../admin-invites/admin-invites.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { BullMqService } from '../bullmq/bullmq.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

const CSV_IMPORT_REDIS_PREFIX = 'cache:csv-import:job';

/**
 * Sanitize a CSV cell value against CSV injection (OWASP A05).
 * Cells starting with = + - @ are prefixed with a single quote.
 */
function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Build a fully RFC 4180 compliant CSV field that is also safe against CSV
 * injection. First applies the anti-injection guard (sanitizeCsvCell), then —
 * if the resulting value contains a delimiter (,), a quote ("), or a line break
 * (\n / \r) — wraps it in double quotes and escapes inner quotes by doubling
 * them. Without this, a nome/reason containing a comma or quote would break the
 * report columns (FR07).
 */
function csvField(value: string): string {
  const guarded = sanitizeCsvCell(value);
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

@Injectable()
export class CsvImportService implements OnModuleInit {
  private readonly logger = new Logger(CsvImportService.name);
  private queue!: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimitsService: PlanLimitsService,
    private readonly groupMembersRepository: GroupMembersRepository,
    private readonly adminInvitesService: AdminInvitesService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly bullMqService: BullMqService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    // CSV_IMPORT_QUEUE_NAME = 'csv-import' — no colon prefix (divergência BMad #1)
    this.queue = this.bullMqService.createQueue(CSV_IMPORT_QUEUE_NAME);
    this.logger.log('csv-import queue initialized');
  }

  getQueue(): Queue {
    return this.queue;
  }

  /**
   * FR04 — enforce members-per-group plan limit BEFORE processing any rows.
   * Mirrors group-members.service.ts:enforceMembersPerGroup but operates on
   * projected count. Rejects the ENTIRE import if the limit would be exceeded
   * (no partial import). NEVER uses planLimitsService.hasCapacity('membersPerGroup')
   * because that method short-circuits and always returns allowed=true (divergência BMad #4).
   */
  async enforcePlanLimit(groupId: string, projectedNewMembers: number): Promise<void> {
    const { tenantId } = getRequestContext();
    const plan = await this.planLimitsService.getPlan(tenantId);
    const limit = getLimit(plan, 'membersPerGroup');
    if (!Number.isFinite(limit)) return;
    const current = await this.groupMembersRepository.countByGroup(groupId);
    if (current + projectedNewMembers > limit) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'PlanLimitReached',
        message: `Limite do plano atingido. Seu plano permite ${limit} membros e o grupo já tem ${current} (${projectedNewMembers} novos excederiam o limite).`,
        details: { resource: 'membersPerGroup', plan, current, limit },
      });
    }
  }

  /**
   * FR04 — enforce members-per-group plan limit PER DESTINATION GROUP before
   * processing any rows. Each row may target a different group (row.grupo name
   * resolves to a group; absent → defaultGroupId). Rows whose group name does
   * not resolve are ignored (they become `failed` later, no member added).
   *
   * Conservative tally: counts every row projecting into a resolved group as a
   * potential new member (aligned with the previous rows.length behaviour — we
   * do not predict existing/invited). Rejects the ENTIRE import (no partial
   * import, §10.4) if ANY destination group would exceed its limit, naming the
   * offending group in a PT-BR actionable message.
   */
  async enforcePlanLimits(defaultGroupId: string, rows: ImportRowInput[]): Promise<void> {
    const { tenantId } = getRequestContext();

    // Tally projected new members per resolved destination groupId, keeping the
    // group display name for the error message.
    const tally = new Map<string, { name: string; count: number }>();

    await withTenantTx(this.prisma, async (tx) => {
      for (const row of rows) {
        let groupId = defaultGroupId;
        let groupName: string;

        if (row.grupo) {
          const group = await tx.group.findFirst({
            where: { name: row.grupo, tenantId },
            select: { id: true, name: true },
          });
          // Unresolved group name → ignored (will be `failed`, no member added).
          if (!group) continue;
          groupId = group.id;
          groupName = group.name;
        } else {
          const group = await tx.group.findFirst({
            where: { id: defaultGroupId, tenantId },
            select: { id: true, name: true },
          });
          groupName = group?.name ?? defaultGroupId;
        }

        const entry = tally.get(groupId);
        if (entry) {
          entry.count += 1;
        } else {
          tally.set(groupId, { name: groupName, count: 1 });
        }
      }
    });

    // Apply the per-group limit. Reuses enforcePlanLimit's plan/limit logic but
    // raises a group-named message instead of the generic one.
    const plan = await this.planLimitsService.getPlan(tenantId);
    const limit = getLimit(plan, 'membersPerGroup');
    if (!Number.isFinite(limit)) return;

    for (const [groupId, { name, count }] of tally) {
      if (count === 0) continue;
      const current = await this.groupMembersRepository.countByGroup(groupId);
      if (current + count > limit) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'PlanLimitReached',
          message: `Limite do plano atingido para o grupo '${name}'. Seu plano permite ${limit} membros e o grupo já tem ${current} (${count} novos excederiam o limite).`,
          details: { resource: 'membersPerGroup', groupId, current, limit },
        });
      }
    }
  }

  /**
   * FR03 — process rows with 4-state machine per row:
   *   created   → user new to platform (created + added to group)
   *   existing  → user already in this tenant's group
   *   invited   → user exists but in another tenant (invite sent)
   *   failed    → group name not found in tenant
   */
  async processRows(rows: ImportRowInput[], defaultGroupId: string): Promise<ImportResultSummary> {
    const { tenantId } = getRequestContext();
    const lines: ImportResultLine[] = [];
    // FIX: invites must NOT be created inside the tx — adminInvitesService uses
    // its own Prisma client (not tx), so on rollback the invite would persist
    // (partial side-effect). Accumulate intents here and flush AFTER commit.
    const pendingInvites: Array<{ inviteeEmail: string; inviteeName: string; groupId: string }> = [];

    await withTenantTx(this.prisma, async (tx) => {
      for (const row of rows) {
        // Resolve group: use row.grupo name if present, else defaultGroupId
        let resolvedGroupId = defaultGroupId;
        let resolvedGroupName: string;

        if (row.grupo) {
          const group = await tx.group.findFirst({
            where: { name: row.grupo, tenantId },
            select: { id: true, name: true },
          });
          if (!group) {
            lines.push({
              rowIndex: row.rowIndex,
              email: row.email,
              nome: row.nome,
              groupName: row.grupo,
              action: 'failed',
              reason: `Grupo '${row.grupo}' não encontrado no tenant`,
            });
            continue;
          }
          resolvedGroupId = group.id;
          resolvedGroupName = group.name;
        } else {
          const group = await tx.group.findFirst({
            where: { id: defaultGroupId, tenantId },
            select: { id: true, name: true },
          });
          resolvedGroupName = group?.name ?? defaultGroupId;
        }

        // Find user globally by email (@unique — no tenant filter)
        const user = await tx.user.findUnique({
          where: { email: row.email.toLowerCase() },
          select: { id: true, email: true },
        });

        if (!user) {
          // State 1: brand new to platform — create user + user_tenant + group_member
          const newUserId = uuidv7();
          await tx.user.create({
            data: {
              id: newUserId,
              name: row.nome,
              email: row.email.toLowerCase(),
              status: 'active',
            },
          });
          await tx.userTenant.create({
            data: {
              id: uuidv7(),
              userId: newUserId,
              tenantId,
              role: 'participante',
            },
          });
          await tx.groupMember.create({
            data: {
              id: uuidv7(),
              tenantId,
              groupId: resolvedGroupId,
              userId: newUserId,
              role: row.papel,
            },
          });
          lines.push({
            rowIndex: row.rowIndex,
            email: row.email,
            nome: row.nome,
            groupName: resolvedGroupName,
            action: 'created',
          });
          continue;
        }

        // Check if user belongs to THIS tenant
        const userTenant = await tx.userTenant.findFirst({
          where: { userId: user.id, tenantId, deletedAt: null },
        });

        if (userTenant) {
          // State 2: already in this tenant — check if already in group
          const existingMember = await tx.groupMember.findFirst({
            where: { userId: user.id, groupId: resolvedGroupId },
          });
          if (!existingMember) {
            // Add to group
            await tx.groupMember.create({
              data: {
                id: uuidv7(),
                tenantId,
                groupId: resolvedGroupId,
                userId: user.id,
                role: row.papel,
              },
            });
          }
          lines.push({
            rowIndex: row.rowIndex,
            email: row.email,
            nome: row.nome,
            groupName: resolvedGroupName,
            action: 'existing',
          });
          continue;
        }

        // State 3: user exists but in another tenant — queue invite for AFTER
        // commit. Creating it here would persist outside the tx (see above).
        pendingInvites.push({
          inviteeEmail: row.email.toLowerCase(),
          inviteeName: row.nome,
          groupId: resolvedGroupId,
        });
        lines.push({
          rowIndex: row.rowIndex,
          email: row.email,
          nome: row.nome,
          groupName: resolvedGroupName,
          action: 'invited',
        });
      }
    });

    // Flush invites only after the import transaction has committed, so a
    // rollback never leaves orphan invites. Preserves idempotency: a pending
    // duplicate invite (409 ConflictException) is silently ignored.
    for (const invite of pendingInvites) {
      try {
        await this.adminInvitesService.create({
          kind: 'group_member',
          inviteeEmail: invite.inviteeEmail,
          inviteeName: invite.inviteeName,
          groupId: invite.groupId,
          expiresInDays: 30,
        });
      } catch (err) {
        // ConflictException = invite already pending (idempotent)
        const isConflict = (err as { status?: number }).status === 409;
        if (!isConflict) {
          this.logger.warn(`Invite creation failed for ${invite.inviteeEmail}: ${(err as Error).message}`);
        }
      }
    }

    const imported = lines.filter((l) => l.action === 'created').length;
    const existing = lines.filter((l) => l.action === 'existing').length;
    const invited = lines.filter((l) => l.action === 'invited').length;
    const failed = lines.filter((l) => l.action === 'failed').length;

    return {
      total: lines.length,
      imported,
      existing,
      invited,
      failed,
      lines,
      reportUrl: null,
      jobId: null,
    };
  }

  /**
   * FR07 — generate a CSV report and upload to object storage.
   * Returns the signed URL, and also mutates summary.reportUrl.
   */
  async generateReport(
    summary: ImportResultSummary,
    tenantId: string,
    jobId: string,
  ): Promise<string> {
    const header = 'nome,email,status,reason\n';
    const bodyRows = summary.lines.map((line) => {
      const nome = csvField(line.nome);
      const email = csvField(line.email);
      const status = csvField(line.action);
      const reason = csvField(line.reason ?? '');
      return `${nome},${email},${status},${reason}`;
    });
    const csv = header + bodyRows.join('\n');
    const buffer = Buffer.from(csv, 'utf-8');

    // PII namespaced by tenant (OWASP MEDIUM #3)
    const objectKey = `csv-import-result/${tenantId}/${jobId}.csv`;
    await this.storageService.upload(objectKey, buffer, 'text/csv');
    const url = await this.storageService.getSignedUrl(objectKey, 86400);

    summary.reportUrl = url;
    return url;
  }

  /**
   * FR10 — emit audit event + domain event after import completes.
   */
  async emitAuditAndEvent(
    userId: string,
    groupId: string,
    summary: ImportResultSummary,
    ipAddress = '',
    userAgent = '',
  ): Promise<void> {
    const { tenantId } = getRequestContext();

    await this.auditService.createEvent({
      userId,
      action: 'import',
      resource: 'group',
      resourceId: groupId,
      ipAddress,
      userAgent,
      newState: {
        imported: summary.imported,
        existing: summary.existing,
        invited: summary.invited,
        failed: summary.failed,
      },
    });

    this.eventEmitter.emit('onboarding.csv_import.completed', {
      eventId: uuidv7(),
      eventType: 'onboarding.csv_import.completed',
      version: 1,
      tenantId,
      timestamp: new Date().toISOString(),
      data: {
        groupId,
        total: summary.total,
        imported: summary.imported,
        existing: summary.existing,
        invited: summary.invited,
        failed: summary.failed,
      },
      metadata: {},
    });
  }

  /**
   * Set the Redis job status payload.
   * Key pattern: cache:csv-import:job:{jobId}
   */
  async setJobStatus(
    jobId: string,
    tenantId: string,
    update: {
      status: 'processing' | 'completed' | 'failed';
      progress: number;
      result?: ImportResultSummary | null;
      failureReason?: string | null;
    },
  ): Promise<void> {
    const existing = await this.redisService.get(`${CSV_IMPORT_REDIS_PREFIX}:${jobId}`);
    const base = existing ? (JSON.parse(existing) as Record<string, unknown>) : {};
    const payload = {
      ...base,
      jobId,
      tenantId,
      status: update.status,
      progress: update.progress,
      result: update.result ?? null,
      failureReason: update.failureReason ?? null,
    };
    await this.redisService.setex(
      `${CSV_IMPORT_REDIS_PREFIX}:${jobId}`,
      86400, // CSV_IMPORT_JOB_TTL_SECONDS
      JSON.stringify(payload),
    );
  }

  /**
   * Get the Redis job status payload. Throws NotFoundException if absent.
   */
  async getJobStatus(jobId: string): Promise<Record<string, unknown>> {
    const raw = await this.redisService.get(`${CSV_IMPORT_REDIS_PREFIX}:${jobId}`);
    if (!raw) throw new NotFoundException('Job not found');
    return JSON.parse(raw) as Record<string, unknown>;
  }
}
