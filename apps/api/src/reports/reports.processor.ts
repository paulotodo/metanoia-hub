import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BullMqService } from '../bullmq/bullmq.service';
import { REPORTS_QUEUE_NAME, type ReportExportJobPayload } from '@metanoia/types';
import { ReportsService } from './reports.service';

@Injectable()
export class ReportsProcessor implements OnModuleInit {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly reportsService: ReportsService,
  ) {}

  onModuleInit(): void {
    this.bullMqService.createWorker(REPORTS_QUEUE_NAME, async (job) => {
      this.logger.log({ jobId: job.id, name: job.name }, 'processing report job');
      if (job.name === 'export-trail-csv') {
        await this.reportsService.processExportJob(
          job.data as Extract<ReportExportJobPayload, { kind: 'trail' }>,
        );
      } else if (job.name === 'export-meeting-csv') {
        // FR63, Story 13-1 — meeting attendance CSV export
        await this.reportsService.processMeetingExportJob(
          job.data as Extract<ReportExportJobPayload, { kind: 'meeting' }>,
        );
      }
    });
    this.logger.log('reports worker initialized');
  }
}
