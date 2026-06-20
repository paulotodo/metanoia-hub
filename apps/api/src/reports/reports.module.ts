import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsProcessor } from './reports.processor';
import { RefreshTenantViewsProcessor } from './jobs/refresh-tenant-views.processor';
import { DetectEvasionRiskProcessor } from './jobs/detect-evasion-risk.processor';
import { TenantReportService } from './tenant-report.service';
import { TenantReportRefreshService } from './tenant-report-refresh.service';
import { BullMqModule } from '../bullmq/bullmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';
import { RadarModule } from '../pastoral/radar/radar.module';
import { EvasionDetectionService } from '../pastoral/evasion-detection.service';
import { EvasionRiskRepository } from '../pastoral/repositories/evasion-risk.repository';

@Module({
  imports: [BullMqModule, PrismaModule, RedisModule, StorageModule, RadarModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportsProcessor,
    RefreshTenantViewsProcessor,
    DetectEvasionRiskProcessor,
    TenantReportService,
    TenantReportRefreshService,
    EvasionDetectionService,
    EvasionRiskRepository,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
