import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { PlanLimitsService } from './plan-limits.service';
import { PlanLimitsGuard } from './plan-limits.guard';

@Module({
  imports: [
    PrismaModule,
    // Explicit import even though RedisModule is @Global — defense in depth
    // against accidental de-globalizing (Story 11-1 / DI gotcha).
    RedisModule,
  ],
  providers: [PlanLimitsService, PlanLimitsGuard],
  exports: [PlanLimitsService, PlanLimitsGuard],
})
export class PlanLimitsModule {}
