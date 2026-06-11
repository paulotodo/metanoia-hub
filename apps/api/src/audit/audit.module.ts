import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { SuperAuditController } from './super-audit.controller';
import { AuditService } from './audit.service';
import { AuditExportProcessor } from './audit-export.processor';
import { AuditInterceptor } from './audit.interceptor';
import { BullMqModule } from '../bullmq/bullmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [BullMqModule, PrismaModule, RedisModule, StorageModule],
  controllers: [AuditController, SuperAuditController],
  providers: [
    AuditService,
    AuditExportProcessor,
    // Global interceptor: captures all state-changing HTTP requests
    // dec-017 (REQ-004): 1 event per request
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
