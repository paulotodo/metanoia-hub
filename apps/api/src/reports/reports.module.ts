import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsProcessor } from './reports.processor';
import { RefreshTenantViewsProcessor } from './jobs/refresh-tenant-views.processor';
import { TenantReportService } from './tenant-report.service';
import { TenantReportRefreshService } from './tenant-report-refresh.service';
import { BullMqModule } from '../bullmq/bullmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [BullMqModule, PrismaModule, RedisModule, StorageModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportsProcessor,
    RefreshTenantViewsProcessor,
    TenantReportService,
    TenantReportRefreshService,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
