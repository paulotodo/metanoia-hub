/**
 * AuditExportProcessor — BullMQ worker for async CSV export of audit events.
 *
 * dec-021 (API-009): previousState/newState serialized as JSON string in CSV cells.
 * dec-020 (API-003): q filter applies to resource + resource_id (not JSONB).
 * Exports: UTF-8 CSV with BOM (Excel compatibility), stored in MinIO, signed URL in Redis.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AUDIT_EXPORT_QUEUE_NAME,
  AUDIT_EXPORT_TTL_SECONDS,
  type AuditExportJobPayload,
  type AuditExportJobStatus,
  AuditEventsQuerySchema,
} from '@metanoia/types';
import { BullMqService } from '../bullmq/bullmq.service';
import { AuditService } from './audit.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';

const AUDIT_JOB_KEY_PREFIX = 'cache:audit:export-job';
const CSV_BOM = '﻿'; // UTF-8 BOM for Excel compatibility

@Injectable()
export class AuditExportProcessor implements OnModuleInit {
  private readonly logger = new Logger(AuditExportProcessor.name);

  constructor(
    private readonly bullMq: BullMqService,
    private readonly auditService: AuditService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    this.bullMq.createWorker(AUDIT_EXPORT_QUEUE_NAME, async (job) => {
      this.logger.log({ jobId: job.id }, 'processing audit export job');
      if (job.name === 'export-audit-csv') {
        await this.processExportJob(job.data as AuditExportJobPayload);
      }
    });
    this.logger.log('audit export worker initialized');
  }

  async processExportJob(payload: AuditExportJobPayload): Promise<void> {
    const { jobId, tenantId, query } = payload;

    try {
      // Fetch all matching events (no pagination for export)
      const result = await this.auditService.listEvents(
        AuditEventsQuerySchema.parse({ ...query, page: 1, perPage: 10000 }),
        tenantId ?? undefined,
      );

      // Build CSV
      const headers = [
        'id', 'tenantId', 'userId', 'action', 'resource', 'resourceId',
        'ipAddress', 'userAgent', 'previousState', 'newState', 'timestamp', 'severity',
      ];

      const rows = result.data.map((e) => [
        e.id,
        e.tenantId,
        e.userId ?? '',
        e.action,
        e.resource,
        e.resourceId ?? '',
        e.ipAddress,
        e.userAgent,
        // dec-021 (API-009): JSONB fields serialized as JSON string in CSV cell
        e.previousState !== null ? JSON.stringify(e.previousState) : '',
        e.newState !== null ? JSON.stringify(e.newState) : '',
        e.timestamp,
        e.severity,
      ]);

      const csvLines = [headers, ...rows].map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      );
      const csv = CSV_BOM + csvLines.join('\n');

      // Upload to MinIO
      const objectKey = `audit-exports/${jobId}.csv`;
      const buffer = Buffer.from(csv, 'utf-8');
      await this.storage.upload(objectKey, buffer, 'text/csv');

      // Generate signed URL (TTL = AUDIT_EXPORT_TTL_SECONDS)
      const signedUrl = await this.storage.getSignedUrl(objectKey, AUDIT_EXPORT_TTL_SECONDS);
      const expiresAt = new Date(Date.now() + AUDIT_EXPORT_TTL_SECONDS * 1000).toISOString();

      const jobState: AuditExportJobStatus = {
        jobId,
        status: 'completed',
        signedUrl,
        expiresAt,
        failureReason: null,
      };

      await this.redis.set(
        `${AUDIT_JOB_KEY_PREFIX}:${jobId}`,
        JSON.stringify(jobState),
        'EX',
        AUDIT_EXPORT_TTL_SECONDS,
      );

      this.logger.log({ jobId, rows: result.data.length }, 'audit export completed');
    } catch (err) {
      this.logger.error({ err, jobId }, 'audit export failed');

      const jobState: AuditExportJobStatus = {
        jobId,
        status: 'failed',
        signedUrl: null,
        expiresAt: null,
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      };

      await this.redis.set(
        `${AUDIT_JOB_KEY_PREFIX}:${jobId}`,
        JSON.stringify(jobState),
        'EX',
        AUDIT_EXPORT_TTL_SECONDS,
      );
    }
  }
}
