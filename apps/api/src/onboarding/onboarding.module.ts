import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BullMqModule } from '../bullmq/bullmq.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';
import { PlanLimitsModule } from '../common/plan-limits/plan-limits.module';
import { GroupMembersModule } from '../group-members/group-members.module';
import { AdminInvitesModule } from '../admin-invites/admin-invites.module';
import { AuditModule } from '../audit/audit.module';
import { OnboardingController } from './onboarding.controller';
import { DemoDataService } from './demo-data.service';
import { OnboardingWizardService } from './onboarding-wizard.service';
import { CsvImportService } from './csv-import.service';
import { CsvImportController, CsvImportJobController } from './csv-import.controller';
import { CsvImportProcessor } from './csv-import.processor';

@Module({
  imports: [
    PrismaModule,
    BullMqModule,
    RedisModule,
    StorageModule,
    PlanLimitsModule,
    GroupMembersModule,
    AdminInvitesModule,
    AuditModule,
  ],
  controllers: [OnboardingController, CsvImportController, CsvImportJobController],
  providers: [DemoDataService, OnboardingWizardService, CsvImportService, CsvImportProcessor],
  exports: [DemoDataService, OnboardingWizardService],
})
export class OnboardingModule {}
