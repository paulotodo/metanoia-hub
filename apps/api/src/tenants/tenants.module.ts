import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { PlanLimitsModule } from '../common/plan-limits/plan-limits.module';
import { RedisModule } from '../redis/redis.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { BrandingService } from './branding.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    PlanLimitsModule,
    // RedisModule is @Global() but imported explicitly as defense in depth
    // against accidental de-globalizing (Story 11-1 / DI gotcha).
    RedisModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, BrandingService],
  exports: [TenantsService, BrandingService],
})
export class TenantsModule {}
