import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { PlanLimitsModule } from '../common/plan-limits/plan-limits.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { ConsentModule } from '../consent/consent.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { BrandingService } from './branding.service';
import { PoliciesService } from './policies.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    PlanLimitsModule,
    // RedisModule is @Global() but imported explicitly as defense in depth
    // against accidental de-globalizing (Story 11-1 / DI gotcha).
    RedisModule,
    // AuditModule: provides AuditService for policy_change events (Story 11-3)
    AuditModule,
    // ConsentModule: provides ConsentRepository for focus_monitoring consent exemption (Story 11-3)
    ConsentModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, BrandingService, PoliciesService],
  exports: [TenantsService, BrandingService, PoliciesService],
})
export class TenantsModule {}
