import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';
import { ConsentRepository } from './consent.repository';
import { ConsentGuard } from './consent.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ConsentController],
  providers: [ConsentService, ConsentRepository, ConsentGuard],
  exports: [ConsentService, ConsentGuard],
})
export class ConsentModule {}
