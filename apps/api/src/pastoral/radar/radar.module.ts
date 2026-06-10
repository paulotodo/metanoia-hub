import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RadarCalculatorRepository } from './radar-calculator.repository';
import { RadarStatusRepository } from './radar-status.repository';
import { RadarCalculatorService } from './radar-calculator.service';
import { RadarCalculationWorker } from './radar-calculation.worker';
import { RadarJobService } from './radar-job.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RadarCalculatorRepository,
    RadarStatusRepository,
    RadarCalculatorService,
    RadarCalculationWorker,
    RadarJobService,
  ],
  exports: [RadarJobService, RadarCalculatorService, RadarStatusRepository],
})
export class RadarModule {}
