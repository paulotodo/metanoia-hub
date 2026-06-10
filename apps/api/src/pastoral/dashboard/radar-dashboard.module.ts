import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RadarDashboardController } from './radar-dashboard.controller';
import { RadarDashboardService } from './radar-dashboard.service';
import { RadarDashboardRepository } from './radar-dashboard.repository';
import { RadarAggregateWorker } from './radar-aggregate.worker';
import { RadarAggregateJobService } from './radar-aggregate-job.service';

// RedisModule and BullMqModule are @Global() — no explicit import needed.

@Module({
  imports: [PrismaModule],
  controllers: [RadarDashboardController],
  providers: [
    RadarDashboardService,
    RadarDashboardRepository,
    RadarAggregateWorker,
    RadarAggregateJobService,
  ],
  exports: [RadarDashboardService, RadarAggregateJobService],
})
export class RadarDashboardModule {}
