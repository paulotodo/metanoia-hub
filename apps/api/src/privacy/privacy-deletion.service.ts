/**
 * PrivacyDeletionService — async LGPD Art. 18 VI deletion for Story 9-2.
 *
 * Decisions embedded:
 *   dec-006: idempotent createJob (2x → same requestId)
 *   dec-007: rollback intra-tenant on failure; replay-safe (status guard)
 *   dec-009: leader guardrail — 422 LEADER_ACTIVE_GROUPS
 *   AVS-03: exponential backoff attempts:3, delay:60_000
 *   dec-012 (Q4): export blocked during deletion_pending → enforced in PrivacyExportService
 *   CHK008: handleJobFailure is explicit method (not inline)
 *   OWASP A01/IDOR: getStatus/cancelRequest always filter by {id, userId}
 */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  PRIVACY_DELETION_QUEUE_NAME,
  PRIVACY_DELETION_GRACE_DAYS,
  PRIVACY_DELETION_DEADLINE_DAYS,
  type PrivacyDeletionResponse,
  type PrivacyDeletionStatus,
  type PrivacyDeletionJobPayload,
} from '@metanoia/types';
import { generateId } from '@metanoia/types';
import { BullMqService } from '../bullmq/bullmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { GroupMembersService } from '../group-members/group-members.service';
import { MeetingsService } from '../meetings/meetings.service';
import { ProgressService } from '../content/progress/progress.service';
import { PastoralService } from '../pastoral/pastoral.service';
import { ConsentService } from '../consent/consent.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PrivacyDeletionService implements OnModuleInit {
  private readonly logger = new Logger(PrivacyDeletionService.name);
  private queue!: Queue;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly usersService: UsersService,
    private readonly groupMembersService: GroupMembersService,
    private readonly meetingsService: MeetingsService,
    private readonly progressService: ProgressService,
    private readonly pastoralService: PastoralService,
    private readonly consentService: ConsentService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit(): void {
    this.queue = this.bullMqService.createQueue(PRIVACY_DELETION_QUEUE_NAME);
    this.logger.log('privacy deletion queue initialized');
  }

  // ─── createJob ────────────────────────────────────────────────────────────────

  /**
   * Create (or return existing) deletion request for userId/tenantId.
   * dec-009: 422 LEADER_ACTIVE_GROUPS if user leads active groups.
   * dec-006: idempotent — if pending/soft_deleted request exists, return it.
   * Immediately sets User.status = 'deletion_pending'.
   */
  async createJob(userId: string, tenantId: string): Promise<PrivacyDeletionResponse> {
    // dec-009: guardrail — leaders cannot self-delete while leading active groups
    const activeGroups = await this.prisma.client.groupMember.findMany({
      where: {
        userId,
        role: 'lider',
        deletedAt: null,
        group: { tenantId },
      },
      select: { group: { select: { id: true, name: true } } },
    });
    if (activeGroups.length > 0) {
      throw new UnprocessableEntityException({
        error: 'LEADER_ACTIVE_GROUPS',
        groups: activeGroups.map((m) => ({ id: m.group.id, name: m.group.name })),
      });
    }

    // dec-006: idempotency — return same requestId if pending or soft_deleted request exists
    const existing = await this.prisma.client.deletionRequest.findFirst({
      where: {
        userId,
        tenantId,
        status: { in: ['pending', 'soft_deleted'] },
      },
      select: {
        id: true,
        status: true,
        cancellableUntil: true,
        deletionDeadline: true,
      },
    });
    if (existing) {
      return {
        requestId: existing.id,
        status: 'pending',
        cancellableUntil: existing.cancellableUntil.toISOString(),
        deletionDeadline: existing.deletionDeadline.toISOString(),
      };
    }

    // Collect all tenant IDs for the user (captured at request time for cross-tenant sweep)
    const userTenants = await this.prisma.client.userTenant.findMany({
      where: { userId, deletedAt: null },
      select: { tenantId: true },
    });
    const allTenantIds = userTenants.map((ut) => ut.tenantId);

    const requestId = generateId();
    const now = new Date();
    const cancellableUntil = new Date(now.getTime() + PRIVACY_DELETION_GRACE_DAYS * 86_400_000);
    const deletionDeadline = new Date(now.getTime() + PRIVACY_DELETION_DEADLINE_DAYS * 86_400_000);

    // Persist DeletionRequest
    await this.prisma.client.deletionRequest.create({
      data: {
        id: requestId,
        tenantId,
        userId,
        status: 'pending',
        allTenantIds,
        cancellableUntil,
        deletionDeadline,
        confirmedAt: now,
      },
    });

    // Immediately mark user as deletion_pending
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { status: 'deletion_pending' },
    });

    // Enqueue soft-delete job (delayed by grace period: 7d)
    const gracePeriodMs = PRIVACY_DELETION_GRACE_DAYS * 86_400_000;
    const softPayload: PrivacyDeletionJobPayload = {
      requestId,
      userId,
      allTenantIds,
      requestedAt: now.toISOString(),
      cancellableUntil: cancellableUntil.toISOString(),
      deletionDeadline: deletionDeadline.toISOString(),
    };
    await this.queue.add('soft-delete-user-data', softPayload, {
      jobId: `soft-${requestId}`,
      delay: gracePeriodMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log('DeletionRequest created', { requestId, userId });

    return {
      requestId,
      status: 'pending',
      cancellableUntil: cancellableUntil.toISOString(),
      deletionDeadline: deletionDeadline.toISOString(),
    };
  }

  // ─── cancelRequest ────────────────────────────────────────────────────────────

  /**
   * Cancel a pending deletion request.
   * OWASP A01/IDOR: always query by {id, userId} — not just id.
   * Returns 404 if not found OR if not owned by userId (prevents enumeration).
   */
  async cancelRequest(requestId: string, userId: string): Promise<void> {
    // IDOR: ownership filter in WHERE
    const request = await this.prisma.client.deletionRequest.findFirst({
      where: { id: requestId, userId },
      select: {
        status: true,
        cancellableUntil: true,
      },
    });

    if (!request) {
      // 404 (not 403) to prevent requestId enumeration
      throw new NotFoundException(`Deletion request ${requestId} not found`);
    }

    if (request.status === 'cancelled') {
      // Already cancelled — idempotent no-op
      return;
    }

    if (!['pending', 'soft_deleted'].includes(request.status)) {
      throw new ConflictException(
        `Cannot cancel deletion request in status '${request.status}'`,
      );
    }

    const now = new Date();
    if (now >= request.cancellableUntil) {
      throw new ConflictException(
        'Cancellation period has expired. The deletion is already in progress.',
      );
    }

    // Cancel request and restore user status
    await this.prisma.client.deletionRequest.update({
      where: { id: requestId },
      data: { status: 'cancelled', cancelledAt: now },
    });

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { status: 'active' },
    });

    // Remove pending BullMQ jobs for this request
    try {
      await this.removePendingJobs(requestId);
    } catch (err) {
      this.logger.warn('Failed to remove BullMQ jobs on cancel (non-fatal)', { requestId, err });
    }

    this.logger.log('DeletionRequest cancelled', { requestId, userId });
  }

  // ─── getStatus ────────────────────────────────────────────────────────────────

  /**
   * Get deletion request status.
   * OWASP A01/IDOR: always query by {id, userId}.
   */
  async getStatus(requestId: string, userId: string): Promise<PrivacyDeletionStatus> {
    // IDOR: ownership filter in WHERE
    const request = await this.prisma.client.deletionRequest.findFirst({
      where: { id: requestId, userId },
      select: {
        id: true,
        status: true,
        cancellableUntil: true,
        deletionDeadline: true,
        cancelledAt: true,
        completedAt: true,
        failureReason: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`Deletion request ${requestId} not found`);
    }

    return {
      requestId: request.id,
      status: request.status as PrivacyDeletionStatus['status'],
      cancellableUntil: request.cancellableUntil.toISOString(),
      deletionDeadline: request.deletionDeadline.toISOString(),
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      completedAt: request.completedAt?.toISOString() ?? null,
      failureReason: request.failureReason ?? null,
    };
  }

  // ─── softDeleteAllTenants ─────────────────────────────────────────────────────

  /**
   * Execute soft-delete across all tenants for this user.
   * dec-007: guard status != 'cancelled' before executing (replay-safe).
   * Called by PrivacyDeletionProcessor for job 'soft-delete-user-data'.
   */
  async softDeleteAllTenants(payload: PrivacyDeletionJobPayload): Promise<void> {
    const { requestId, userId, allTenantIds } = payload;

    // Replay-safe: skip if cancelled
    const request = await this.prisma.client.deletionRequest.findFirst({
      where: { id: requestId },
      select: { status: true },
    });
    if (!request || request.status === 'cancelled') {
      this.logger.log('softDeleteAllTenants: skipping (cancelled or not found)', { requestId });
      return;
    }

    for (const tenantId of allTenantIds) {
      await this.usersService.softDeleteUserData(userId, tenantId);
      await this.groupMembersService.softDeleteUserData(userId, tenantId);
      await this.meetingsService.softDeleteUserData(userId, tenantId);
      await this.progressService.softDeleteUserData(userId, tenantId);
      await this.pastoralService.softDeleteUserData(userId, tenantId);
      await this.consentService.softDeleteUserData(userId, tenantId);
      await this.auditService.softDeleteUserData(userId, tenantId);
    }

    // Update request status to soft_deleted
    await this.prisma.client.deletionRequest.update({
      where: { id: requestId },
      data: { status: 'soft_deleted' },
    });

    // Enqueue hard-delete job (delayed until deletionDeadline)
    const deadline = new Date(payload.deletionDeadline);
    const delayMs = Math.max(0, deadline.getTime() - Date.now());
    const hardPayload: PrivacyDeletionJobPayload = payload;
    await this.queue.add('hard-delete-user-data', hardPayload, {
      jobId: `hard-${requestId}`,
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log('softDeleteAllTenants: completed, hard-delete enqueued', { requestId });
  }

  // ─── hardDeleteAllTenants ─────────────────────────────────────────────────────

  /**
   * Execute hard-delete across all tenants for this user.
   * dec-007: guard status != 'cancelled' before executing.
   * Each tenant runs in its own Prisma transaction for rollback isolation.
   * Called by PrivacyDeletionProcessor for job 'hard-delete-user-data'.
   */
  async hardDeleteAllTenants(payload: PrivacyDeletionJobPayload): Promise<void> {
    const { requestId, userId, allTenantIds } = payload;

    // Replay-safe: skip if cancelled
    const request = await this.prisma.client.deletionRequest.findFirst({
      where: { id: requestId },
      select: { status: true },
    });
    if (!request || request.status === 'cancelled') {
      this.logger.log('hardDeleteAllTenants: skipping (cancelled or not found)', { requestId });
      return;
    }

    // Hard-delete per tenant (intra-tenant transaction — dec-007 rollback isolation)
    for (const tenantId of allTenantIds) {
      await this.prisma.client.$transaction(async (tx) => {
        // Issue SET LOCAL so RLS policies resolve (worker is privileged — bypass via $executeRaw)
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${tenantId}'`,
        );
        // All hard-deletes via service methods that accept tx (worker-privileged path)
        await this.groupMembersService.hardDeleteUserData(userId, tenantId, tx);
        await this.meetingsService.hardDeleteUserData(userId, tenantId, tx);
        await this.progressService.hardDeleteUserData(userId, tenantId, tx);
        await this.pastoralService.hardDeleteUserData(userId, tenantId, tx);
        // consent: no-op (LGPD art. 16 — retain)
        await this.consentService.hardDeleteUserData(userId, tenantId);
        // audit: handled outside tx (uses $executeRaw directly on privileged client)
        await this.auditService.hardDeleteUserData(userId, tenantId);
        // user tenants: delete association for this tenant
        await this.usersService.hardDeleteUserData(userId, tenantId, tx);
      });
    }

    // Note: usersService.hardDeleteUserData handles user_tenants deletion AND user anonymization
    // inside the per-tenant transaction. The user row is kept (FK chain) but name/email anonymized.

    // Cleanup Redis keys for this user
    await this.cleanupRedis(userId);

    // Cleanup MinIO objects for this user
    await this.cleanupMinio(userId);

    // Emit audit event for deletion completion
    await this.emitDeletionCompletedEvent(userId, requestId);

    // Mark request as hard_deleted
    await this.prisma.client.deletionRequest.update({
      where: { id: requestId },
      data: { status: 'hard_deleted', completedAt: new Date() },
    });

    this.logger.log('hardDeleteAllTenants: completed', { requestId });
  }

  // ─── handleJobFailure ─────────────────────────────────────────────────────────

  /**
   * Handle job failure after all BullMQ retry attempts exhausted. (CHK008)
   * Updates DeletionRequest.status = 'failed', logs to Sentry, alerts DPO.
   */
  async handleJobFailure(requestId: string, reason: string): Promise<void> {
    this.logger.error('DeletionJob failed after all retries', { requestId, reason });

    await this.prisma.client.deletionRequest.update({
      where: { id: requestId },
      data: { status: 'failed', failureReason: reason },
    });

    // Sentry capture (best-effort — Sentry may not be initialized in all envs)
    try {
      const Sentry = await import('@sentry/node').catch(() => null);
      if (Sentry) {
        Sentry.captureException(new Error(`DeletionJob failed: ${reason}`), {
          extra: { requestId, reason },
          level: 'error',
        });
      }
    } catch {
      this.logger.warn('Sentry not available for deletion failure alert');
    }

    // DPO alert (stub — real implementation would use notification service)
    this.logger.error('DPO ALERT: deletion job failed — manual intervention required', {
      requestId,
      reason,
      alert: 'dpo-notification',
    });
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────

  private async cleanupRedis(userId: string): Promise<void> {
    const patterns = [
      `session:${userId}:*`,
      `cache:*:${userId}:*`,
      `rt:${userId}:*`,
    ];

    for (const pattern of patterns) {
      try {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch (err) {
        this.logger.warn(`Redis cleanup failed for pattern ${pattern} (non-fatal)`, { userId, err });
      }
    }
  }

  private async cleanupMinio(userId: string): Promise<void> {
    const prefixes = [`user/${userId}/`, `exports/global/${userId}/`];

    for (const prefix of prefixes) {
      try {
        const bucket = (this.storage as unknown as { bucket: string }).bucket;
        const minioClient = (this.storage as unknown as { client: import('minio').Client }).client;

        const objects: string[] = [];
        await new Promise<void>((resolve, reject) => {
          const stream = minioClient.listObjects(bucket, prefix, true);
          stream.on('data', (obj) => {
            if (obj.name) objects.push(obj.name);
          });
          stream.on('end', resolve);
          stream.on('error', reject);
        });

        for (const key of objects) {
          await minioClient.removeObject(bucket, key);
        }

        if (objects.length > 0) {
          this.logger.log(`MinIO cleanup: removed ${objects.length} objects under ${prefix}`);
        }
      } catch (err) {
        this.logger.warn(`MinIO cleanup failed for prefix ${prefix} (non-fatal)`, { userId, err });
      }
    }
  }

  private async removePendingJobs(requestId: string): Promise<void> {
    const softJob = await this.queue.getJob(`soft-${requestId}`);
    if (softJob) await softJob.remove();

    const hardJob = await this.queue.getJob(`hard-${requestId}`);
    if (hardJob) await hardJob.remove();
  }

  private async emitDeletionCompletedEvent(userId: string, requestId: string): Promise<void> {
    try {
      await this.auditService.createEvent({
        userId: null,
        action: 'delete',
        resource: 'privacy.deletion',
        resourceId: requestId,
        ipAddress: 'worker',
        userAgent: 'privacy-deletion-processor',
        newState: { requestId, userId, completedAt: new Date().toISOString() },
      });
    } catch (err) {
      this.logger.warn('Failed to emit privacy.deletion.completed audit event (non-fatal)', {
        requestId,
        err,
      });
    }
  }
}
