import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PastoralController } from './pastoral.controller';
import { PastoralService } from './pastoral.service';
import { PastoralRepository } from './pastoral.repository';
import { RadarModule } from './radar/radar.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [PrismaModule, RadarModule, AlertsModule],
  controllers: [PastoralController],
  providers: [PastoralService, PastoralRepository],
  exports: [PastoralService],
})
export class PastoralModule {}
