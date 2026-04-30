import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlanLimitsService } from './plan-limits.service';
import { PlanLimitsGuard } from './plan-limits.guard';

@Module({
  imports: [PrismaModule],
  providers: [PlanLimitsService, PlanLimitsGuard],
  exports: [PlanLimitsService, PlanLimitsGuard],
})
export class PlanLimitsModule {}
