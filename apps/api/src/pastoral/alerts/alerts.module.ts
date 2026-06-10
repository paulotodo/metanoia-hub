import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AlertsController],
  providers: [AlertsRepository, AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
