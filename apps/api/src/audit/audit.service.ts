/**
 * AuditService — append-only audit event persistence and export.
 *
 * Architecture decisions embedded here:
 *   dec-015 (SEC-005): id via generateId() (UUIDv7)
 *   dec-016 (SEC-011): previousState from AuditContext (AsyncLocalStorage),
 *                       null when not set by service
 *   dec-017 (REQ-004): 1 event per request (not N per bulk operation)
 *   dec-019 (SEC-007): JSONB payload truncated if > AUDIT_PAYLOAD_TRUNCATE_BYTES
 *   dec-020 (API-003): q searches resource + resource_id via ILIKE (not JSONB)
 *   dec-022 (API-012): offset-based pagination
 *   FR-INFRA-02 / SEC-002: no update() or delete() methods exposed
 */
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import {
  AUDIT_EXPORT_QUEUE_NAME,
  AUDIT_EXPORT_TTL_SECONDS,
  AUDIT_PAYLOAD_TRUNCATE_BYTES,
  type AuditAction,
  type AuditEventListResponse,
  type AuditEventsQuery,
  type AuditExportData,
  type AuditExportJobPayload,
  type AuditExportJobStatus,
  generateId,
} from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { BullMqService } from '../bullmq/bullmq.service';
import { RedisService } from '../redis/redis.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { requestContext } from '../common/context/request-context';
import { getAuditSeverity } from './audit.severity';
import { getAuditPreviousState } from './audit-context';

const AUDIT_JOB_KEY_PREFIX = 'cache:audit:export-job';

export interface CreateAuditEventDto {
  userId: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string | null;
  ipAddress: string;
  userAgent: string;
  newState: Record<string, unknown> | null;
}

/**
 * Truncates a JSONB payload if its JSON representation exceeds the byte limit.
 * dec-019 (SEC-007): always produces valid JSON.
 */
function truncatePayload(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (value === null) return null;
  const json = JSON.stringify(value);
  if (json.length <= AUDIT_PAYLOAD_TRUNCATE_BYTES) return value;
  return {
    __truncated: true,
    __originalSize: json.length,
    __sample: json.slice(0, 1000),
  };
}

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);
  private queue!: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bullMq: BullMqService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.queue = this.bullMq.createQueue(AUDIT_EXPORT_QUEUE_NAME);
    this.logger.log('audit queue initialized');
  }

  // ─── Write ───────────────────────────────────────────────────────────────────

  /**
   * Creates a single audit event for the current tenant.
   * Tenant is resolved from AsyncLocalStorage (never passed as parameter).
   * dec-016: previousState from AuditContext (set by service before mutation).
   * dec-019: payloads truncated if > 65536 bytes.
   * FR-INFRA-02: this is the ONLY write path — no update/delete exposed.
   */
  async createEvent(dto: CreateAuditEventDto): Promise<void> {
    // Tenant comes from AsyncLocalStorage (never a parameter — multi-tenancy rule).
    // The `withMultiTenant` Prisma extension that used to auto-inject tenant_id on
    // every write was removed in Story 7-7; `withTenantTx` only issues SET LOCAL for
    // RLS and does NOT populate the INSERT column. So tenant_id must be written
    // explicitly here — the previous `tenantId: ''` placeholder produced
    // `invalid input syntax for type uuid: ""` and silently dropped every event
    // (fire-and-forget swallowed the error).
    // audit_events.tenant_id is NOT NULL uuid — a public/unauthenticated route has no
    // tenant to attribute the event to, so skip silently (FR-INFRA-01: never throw).
    const tenantId = requestContext.getStore()?.tenantId ?? '';
    if (!tenantId) {
      this.logger.debug(
        { action: dto.action, resource: dto.resource },
        'audit event skipped: no tenant in request context',
      );
      return;
    }

    const severity = getAuditSeverity(dto.action, dto.resource);
    const previousState = truncatePayload(getAuditPreviousState());
    const newState = truncatePayload(dto.newState);

    try {
      await withTenantTx(
        this.prisma,
        async (tx) => {
          await tx.auditEvent.create({
            data: {
              id: generateId(),
              tenantId,
              userId: dto.userId,
              action: dto.action,
              resource: dto.resource,
              resourceId: dto.resourceId,
              ipAddress: dto.ipAddress,
              userAgent: dto.userAgent,
              // Prisma nullable JSON: use undefined to omit, or cast to InputJsonValue
              previousState: previousState !== null
                ? (previousState as Prisma.InputJsonValue)
                : undefined,
              newState: newState !== null
                ? (newState as Prisma.InputJsonValue)
                : undefined,
              severity,
            },
          });
        },
        { tenantId },
      );
    } catch (err) {
      // Audit failures must NEVER propagate to the caller (FR-INFRA-01)
      this.logger.error({ err, action: dto.action, resource: dto.resource }, 'audit event write failed');
    }
  }

  // ─── Read ─────────────────────────────────────────────────────────────────────

  /**
   * Lists audit events for the current tenant (RLS-scoped).
   * For Super Admin cross-tenant reads, pass prismaClient = prisma.client directly.
   * dec-020: q searches resource + resource_id via ILIKE (not JSONB fields).
   * dec-022: offset-based pagination.
   */
  async listEvents(
    query: AuditEventsQuery,
    tenantId?: string,
  ): Promise<AuditEventListResponse> {
    const { page, perPage, action, severity, userId, resource, q, dateFrom, dateTo } = query;
    const skip = (page - 1) * perPage;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (action) where['action'] = action;
    if (severity) where['severity'] = severity;
    if (userId) where['userId'] = userId;
    if (resource) where['resource'] = resource;
    if (dateFrom || dateTo) {
      where['timestamp'] = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }
    if (q) {
      where['OR'] = [
        { resource: { contains: q, mode: 'insensitive' } },
        { resourceId: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (tenantId) {
      // Super Admin cross-tenant read: use prisma.client directly (bypasses RLS)
      // dec-015 (SEC-005): confirmed pattern from super-admin-tenants.repository.ts
      where['tenantId'] = tenantId;
      const [rows, total] = await Promise.all([
        this.prisma.client.auditEvent.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: perPage,
        }),
        this.prisma.client.auditEvent.count({ where }),
      ]);
      return this.buildListResponse(rows, page, perPage, total);
    }

    // Tenant-scoped read via withTenantTx (RLS)
    return withTenantTx(this.prisma, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.auditEvent.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: perPage,
        }),
        tx.auditEvent.count({ where }),
      ]);
      return this.buildListResponse(rows, page, perPage, total);
    });
  }

  // ─── Export ───────────────────────────────────────────────────────────────────

  /**
   * Enqueues an async CSV export job.
   * Returns a jobId for polling via getExportJobStatus.
   */
  async createExportJob(
    query: Omit<AuditEventsQuery, 'page' | 'perPage'>,
    tenantId: string | null,
    requestedBy: string,
  ): Promise<{ jobId: string }> {
    const jobId = generateId();
    const payload: AuditExportJobPayload = {
      jobId,
      tenantId,
      requestedBy,
      query,
    };

    await this.queue.add('export-audit-csv', payload, {
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
    });

    const jobState: AuditExportJobStatus = {
      jobId,
      status: 'processing',
      signedUrl: null,
      expiresAt: null,
      failureReason: null,
    };

    await this.redis.set(
      `${AUDIT_JOB_KEY_PREFIX}:${jobId}`,
      JSON.stringify(jobState),
      'EX',
      AUDIT_EXPORT_TTL_SECONDS,
    );

    return { jobId };
  }

  /**
   * Polls export job status from Redis.
   * Throws NotFoundException if job not found (expired or never existed).
   */
  async getExportJobStatus(jobId: string): Promise<AuditExportJobStatus> {
    const raw = await this.redis.get(`${AUDIT_JOB_KEY_PREFIX}:${jobId}`);
    if (!raw) {
      throw new NotFoundException(`Export job ${jobId} not found or expired`);
    }
    return JSON.parse(raw) as AuditExportJobStatus;
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  private buildListResponse(
    rows: Array<{
      id: string;
      tenantId: string;
      userId: string | null;
      action: string;
      resource: string;
      resourceId: string | null;
      ipAddress: string;
      userAgent: string;
      previousState: unknown;
      newState: unknown;
      timestamp: Date;
      severity: string;
    }>,
    page: number,
    perPage: number,
    total: number,
  ): AuditEventListResponse {
    return {
      data: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        userId: r.userId,
        action: r.action as AuditAction,
        resource: r.resource,
        resourceId: r.resourceId,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        previousState: (r.previousState as Record<string, unknown> | null) ?? null,
        newState: (r.newState as Record<string, unknown> | null) ?? null,
        timestamp: r.timestamp.toISOString(),
        severity: r.severity as 'info' | 'warning' | 'critical',
      })),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Export audit events for a user within a tenant.
   * Privileged — uses prisma.client directly (no RLS). Never throws.
   * userId is nullable on AuditEvent — filter with { equals: userId }.
   */
  /**
   * Soft-delete for audit: NO-OP (anonimização only happens in hard-delete).
   * Audit log is immutable (Story 9-3) — never soft-deleted.
   */
  async softDeleteUserData(_userId: string, _tenantId: string): Promise<void> {
    // No-op: anonimização occurs in hard-delete only (imutabilidade 9-3)
  }

  /**
   * Hard-delete for audit: anonymize user reference (Story 9-2 / LGPD Art. 18 VI).
   * Sets user_id = NULL and anonymized_user_ref = 'anonymous-<hash>' for all audit events.
   * audit_events rows are NEVER DELETED (imutabilidade 9-3).
   * Uses prisma.client directly (superuser, bypasses RLS — cross-tenant visibility required).
   * hash = sha256(userId + ANONYMIZATION_SALT).slice(0,8) — same salt as users anonymization.
   */
  async hardDeleteUserData(userId: string, tenantId: string): Promise<void> {
    const anonymizationSalt = process.env['ANONYMIZATION_SALT'] ?? 'metanoia-deletion-salt';
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256')
      .update(userId + anonymizationSalt)
      .digest('hex')
      .slice(0, 8);
    const anonymizedRef = `anonymous-${hash}`;

    // Direct executeRaw — bypasses Prisma model constraints (no update/delete exposed on AuditEvent)
    await this.prisma.client.$executeRaw`
      UPDATE audit_events
      SET user_id = NULL,
          anonymized_user_ref = ${anonymizedRef}
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
    `;
  }

  async exportUserData(userId: string, tenantId: string): Promise<AuditExportData> {
    const events = await this.prisma.client.auditEvent.findMany({
      where: { userId: { equals: userId }, tenantId },
      select: { action: true, resource: true, resourceId: true, timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    return {
      events: events.map((e) => ({
        action: e.action,
        resource: e.resource,
        resourceId: e.resourceId,
        timestamp: e.timestamp.toISOString(),
      })),
    };
  }
}
