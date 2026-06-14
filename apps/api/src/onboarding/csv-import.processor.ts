import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CSV_IMPORT_QUEUE_NAME, type ImportRowInput } from '@metanoia/types';
import { requestContext } from '../common/context/request-context';
import { BullMqService } from '../bullmq/bullmq.service';
import { CsvImportService } from './csv-import.service';

interface CsvImportJobPayload {
  rows: ImportRowInput[];
  defaultGroupId: string;
  groupId: string;
  jobId: string;
  tenantId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

const BATCH_SIZE = 50;

@Injectable()
export class CsvImportProcessor implements OnModuleInit {
  private readonly logger = new Logger(CsvImportProcessor.name);

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly csvImportService: CsvImportService,
  ) {}

  onModuleInit(): void {
    this.bullMqService.createWorker(CSV_IMPORT_QUEUE_NAME, this.handleJob.bind(this));
    this.logger.log('csv-import worker initialized');
  }

  private async handleJob(job: Job<CsvImportJobPayload>): Promise<void> {
    const { rows, defaultGroupId, groupId, jobId, tenantId, userId, ipAddress = '', userAgent = '' } = job.data;
    this.logger.log({ jobId, rowCount: rows.length }, 'processing csv-import job');

    try {
      // Run inside a request context so withTenantTx + getRequestContext() work
      await requestContext.run({ tenantId, userId, requestId: jobId, correlationId: jobId }, async () => {
        const totalRows = rows.length;
        const allLines: Awaited<ReturnType<typeof this.csvImportService.processRows>>['lines'] = [];
        let processedCount = 0;

        // Process in batches and update Redis progress incrementally
        // NB: divergência BMad #5 — we do NOT use job.updateProgress();
        //     progress is stored in Redis cache:csv-import:job:{jobId}
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const batchResult = await this.csvImportService.processRows(batch, defaultGroupId);
          allLines.push(...batchResult.lines);
          processedCount += batch.length;

          const progress = Math.round((processedCount / totalRows) * 100);
          await this.csvImportService.setJobStatus(jobId, tenantId, {
            status: 'processing',
            progress,
            result: null,
            failureReason: null,
          });
        }

        // Aggregate final summary
        const imported = allLines.filter((l) => l.action === 'created').length;
        const existing = allLines.filter((l) => l.action === 'existing').length;
        const invited = allLines.filter((l) => l.action === 'invited').length;
        const failed = allLines.filter((l) => l.action === 'failed').length;

        const summary = {
          total: allLines.length,
          imported,
          existing,
          invited,
          failed,
          lines: allLines,
          reportUrl: null as string | null,
          jobId,
        };

        // Generate CSV report and upload to storage
        await this.csvImportService.generateReport(summary, tenantId, jobId);

        // Emit audit event
        await this.csvImportService.emitAuditAndEvent(userId, groupId, summary, ipAddress, userAgent);

        // Mark completed in Redis
        await this.csvImportService.setJobStatus(jobId, tenantId, {
          status: 'completed',
          progress: 100,
          result: summary,
          failureReason: null,
        });

        this.logger.log({ jobId, imported, existing, invited, failed }, 'csv-import job completed');
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ jobId, error: message }, 'csv-import job failed');

      await this.csvImportService.setJobStatus(jobId, tenantId, {
        status: 'failed',
        progress: 0,
        result: null,
        failureReason: message,
      });

      throw err; // re-throw so BullMQ can apply retry logic
    }
  }
}
