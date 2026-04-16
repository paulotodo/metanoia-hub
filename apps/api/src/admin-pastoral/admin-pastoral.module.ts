import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ChurchController,
  OutreachIntentController,
} from './admin-pastoral.controller';
import { AdminPastoralService } from './admin-pastoral.service';
import { AdminPastoralRepository } from './admin-pastoral.repository';

@Module({
  imports: [PrismaModule],
  controllers: [ChurchController, OutreachIntentController],
  providers: [AdminPastoralService, AdminPastoralRepository],
  exports: [AdminPastoralService],
})
export class AdminPastoralModule {}
