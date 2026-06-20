import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { PlanLimitsModule } from '../common/plan-limits/plan-limits.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { SuperAdminTenantsController } from './super-admin-tenants.controller';
import { SuperAdminTenantsService } from './super-admin-tenants.service';
import { SuperAdminTenantsRepository } from './super-admin-tenants.repository';
import { SuperAdminPlansController } from './super-admin-plans.controller';
import { SuperAdminPlansService } from './super-admin-plans.service';
import { SuperAdminPlansRepository } from './super-admin-plans.repository';
import { PlatformMetricsService } from './platform-metrics.service';
import { PlatformMetricsController } from './platform-metrics.controller';
import { BullMqModule } from '../bullmq/bullmq.module';

@Module({
  imports: [
    PrismaModule,
    OnboardingModule,
    // PlanLimitsModule exports PlanLimitsService — required by:
    //   SuperAdminTenantsService (write-through after override PATCH)
    //   SuperAdminPlansService (write-through after plan PATCH)
    // DI GOTCHA: without this import, boot crashes with "Nest can't resolve dependencies"
    PlanLimitsModule,
    RedisModule,
    AuditModule,
    BullMqModule,
  ],
  controllers: [SuperAdminTenantsController, SuperAdminPlansController, PlatformMetricsController],
  providers: [
    SuperAdminTenantsService,
    SuperAdminTenantsRepository,
    SuperAdminPlansService,
    SuperAdminPlansRepository,
    PlatformMetricsService,
  ],
  exports: [SuperAdminTenantsService],
})
export class SuperAdminTenantsModule {}
