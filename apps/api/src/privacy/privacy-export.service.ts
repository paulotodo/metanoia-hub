/**
 * PrivacyExportService — async data export for LGPD Art. 20 (Story 9-1).
 *
 * Decisions embedded:
 *   dec-019 (CHK018): MinIO prefix = `exports/global/`
 *   dec-020 (CHK021): BullMQ exponential backoff 60s / 300s / 1800s
 *   CL-02: UserProfileExport excludes tenantId
 *   CL-04/dec-021: PastoralAction excluded
 *   CHK008: handleJobFailure is explicit method (not inline)
 */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type PDFDocument from 'pdfkit';
import {
  PRIVACY_EXPORT_QUEUE_NAME,
  PRIVACY_EXPORT_JOB_KEY_PREFIX,
  PRIVACY_EXPORT_JOB_TTL_SECONDS,
  PRIVACY_EXPORT_SIGNED_URL_SECONDS,
  PRIVACY_EXPORT_ESTIMATED_HOURS,
  FullExportPayloadSchema,
  type PrivacyExportJobResponse,
  type PrivacyExportStatus,
  type PrivacyExportJobPayload,
  type FullExportPayload,
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
export class PrivacyExportService implements OnModuleInit {
  private readonly logger = new Logger(PrivacyExportService.name);
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
    this.queue = this.bullMqService.createQueue(PRIVACY_EXPORT_QUEUE_NAME);
    this.logger.log('privacy export queue initialized');
  }

  /**
   * Create a new data export job.
   * Returns 409 if an active job already exists for this user+tenant.
   */
  async createJob(
    userId: string,
    format: 'json' | 'pdf',
    tenantId: string,
  ): Promise<PrivacyExportJobResponse> {
    // dec-012 (Q4): block export when user has a pending deletion request
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (user?.status === 'deletion_pending') {
      throw new ConflictException(
        'Cannot create export while a deletion request is pending. Cancel the deletion request first.',
      );
    }

    // Check for existing active job
    const existing = await this.prisma.client.privacyExportJob.findFirst({
      where: {
        userId,
        tenantId,
        status: { in: ['accepted', 'processing'] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active export job already exists. Wait for it to complete before requesting a new one.',
      );
    }

    // Collect all tenant IDs for the user (captured at request time)
    const userTenants = await this.prisma.client.userTenant.findMany({
      where: { userId },
      select: { tenantId: true },
    });
    const allTenantIds = userTenants.map((ut) => ut.tenantId);

    const jobId = generateId();
    const requestedAt = new Date();

    // Persist job record
    await this.prisma.client.privacyExportJob.create({
      data: {
        id: jobId,
        tenantId,
        userId,
        format,
        status: 'accepted',
        allTenantIds,
        requestedAt,
      },
    });

    // Enqueue BullMQ job — exponential backoff 1m/5m/30m (dec-020)
    const payload: PrivacyExportJobPayload = {
      jobId,
      userId,
      format,
      allTenantIds,
      requestedAt: requestedAt.toISOString(),
    };
    await this.queue.add('export-personal-data', payload, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: true,
      removeOnFail: true,
    });

    // Write initial Redis status
    const statusPayload: PrivacyExportStatus = {
      jobId,
      status: 'accepted',
      signedUrl: null,
      expiresAt: null,
      failureReason: null,
    };
    await this.redis.set(
      `${PRIVACY_EXPORT_JOB_KEY_PREFIX}:${jobId}`,
      JSON.stringify(statusPayload),
      'EX',
      PRIVACY_EXPORT_JOB_TTL_SECONDS,
    );

    this.logger.log('PrivacyExportJob created', { jobId, format });

    return {
      jobId,
      status: 'accepted',
      estimatedCompletionHours: PRIVACY_EXPORT_ESTIMATED_HOURS,
    };
  }

  /**
   * Poll job status from Redis.
   * Returns 404 if job not found (expired or invalid ID).
   */
  async getJobStatus(jobId: string): Promise<PrivacyExportStatus> {
    const raw = await this.redis.get(`${PRIVACY_EXPORT_JOB_KEY_PREFIX}:${jobId}`);
    if (!raw) {
      throw new NotFoundException(`Export job ${jobId} not found or expired`);
    }
    return JSON.parse(raw) as PrivacyExportStatus;
  }

  /**
   * Process a queued export job.
   * Called by PrivacyExportProcessor (BullMQ worker, privileged — no RLS).
   */
  async processExportJob(payload: PrivacyExportJobPayload): Promise<void> {
    const { jobId, userId, format, allTenantIds } = payload;

    // Mark as processing
    await this.updateStatus(jobId, { status: 'processing' });

    // Collect user data (once — not per-tenant)
    const userData = await this.usersService.exportUserData(userId, '');

    // Collect per-tenant data
    const tenants: FullExportPayload['tenants'] = [];
    for (const tenantId of allTenantIds) {
      const [groups, meetings, trails, pastoral, consent, audit] = await Promise.all([
        this.groupMembersService.exportUserData(userId, tenantId),
        this.meetingsService.exportUserData(userId, tenantId),
        this.progressService.exportUserData(userId, tenantId),
        this.pastoralService.exportUserData(userId, tenantId),
        this.consentService.exportConsentData(userId, tenantId),
        this.auditService.exportUserData(userId, tenantId),
      ]);
      tenants.push({ tenantId, groups, meetings, trails, pastoral, consent, audit });
    }

    const exportedAt = new Date().toISOString();
    const fullPayload: FullExportPayload = {
      exportedAt,
      format,
      user: userData,
      tenants,
    };

    // Validate against schema before upload (quality gate)
    FullExportPayloadSchema.parse(fullPayload);

    // Serialize
    let buffer: Buffer;
    let mimeType: string;
    const datePart = exportedAt.slice(0, 10); // YYYY-MM-DD
    const objectKey = `exports/global/${userId}/${datePart}-${jobId}.${format}`;

    if (format === 'pdf') {
      buffer = await this.generatePdf(fullPayload);
      mimeType = 'application/pdf';
    } else {
      buffer = Buffer.from(JSON.stringify(fullPayload, null, 2), 'utf-8');
      mimeType = 'application/json';
    }

    // Upload to MinIO
    await this.storage.upload(objectKey, buffer, mimeType);

    // Generate signed URL (48h)
    const signedUrl = await this.storage.getSignedUrl(objectKey, PRIVACY_EXPORT_SIGNED_URL_SECONDS);
    const expiresAt = new Date(Date.now() + PRIVACY_EXPORT_SIGNED_URL_SECONDS * 1000).toISOString();

    // Update DB — do NOT log signedUrl (only Logger.debug)
    await this.prisma.client.privacyExportJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        objectKey,
        signedUrl,
        expiresAt: new Date(expiresAt),
        completedAt: new Date(),
      },
    });

    this.logger.debug('PrivacyExportJob signed URL generated', { jobId, objectKey });

    // Update Redis
    await this.updateStatus(jobId, {
      status: 'completed',
      signedUrl,
      expiresAt,
      failureReason: null,
    });

    // Stub: enqueue notification
    try {
      const notifQueue = this.bullMqService.createQueue('queue:notifications');
      await notifQueue.add('privacy-export-ready', { userId, format });
    } catch {
      this.logger.warn('Failed to enqueue privacy-export-ready notification (non-fatal)');
    }

    this.logger.log('PrivacyExportJob completed', { jobId, format });
  }

  /**
   * Handle job failure after all BullMQ retry attempts exhausted.
   * Updates DB and Redis with status: 'failed'. (CHK008)
   */
  async handleJobFailure(jobId: string, reason: string): Promise<void> {
    this.logger.error('PrivacyExportJob failed', { jobId, reason });

    await this.prisma.client.privacyExportJob.update({
      where: { id: jobId },
      data: { status: 'failed', failureReason: reason },
    });

    await this.updateStatus(jobId, {
      status: 'failed',
      signedUrl: null,
      expiresAt: null,
      failureReason: reason,
    });
  }

  /**
   * Generate a PDF buffer from FullExportPayload using pdfkit.
   */
  async generatePdf(payload: FullExportPayload): Promise<Buffer> {
    // Dynamic import to avoid loading pdfkit unless needed
    const PDFDocumentCtor = (await import('pdfkit')).default as typeof PDFDocument;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocumentCtor({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(18).text('Exportação de Dados Pessoais — LGPD Art. 20', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Gerado em: ${payload.exportedAt}`);
      doc.moveDown();

      // User section
      doc.fontSize(14).text('Dados do Usuário');
      doc.fontSize(10).text(JSON.stringify(payload.user, null, 2));
      doc.moveDown();

      // Per-tenant sections
      for (const tenant of payload.tenants) {
        doc.fontSize(14).text(`Tenant: ${tenant.tenantId}`);
        doc.fontSize(10).text(JSON.stringify(tenant, null, 2));
        doc.moveDown();
      }

      doc.end();
    });
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  private async updateStatus(
    jobId: string,
    patch: Partial<PrivacyExportStatus>,
  ): Promise<void> {
    const raw = await this.redis.get(`${PRIVACY_EXPORT_JOB_KEY_PREFIX}:${jobId}`);
    const current: PrivacyExportStatus = raw
      ? (JSON.parse(raw) as PrivacyExportStatus)
      : { jobId, status: 'accepted', signedUrl: null, expiresAt: null, failureReason: null };

    const updated: PrivacyExportStatus = { ...current, ...patch };
    await this.redis.set(
      `${PRIVACY_EXPORT_JOB_KEY_PREFIX}:${jobId}`,
      JSON.stringify(updated),
      'EX',
      PRIVACY_EXPORT_JOB_TTL_SECONDS,
    );
  }
}
