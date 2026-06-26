import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAccessibilityController } from './admin-accessibility.controller';
import { AdminAccessibilityService } from './admin-accessibility.service';
import { AdminAccessibilityRepository } from './admin-accessibility.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AdminAccessibilityController],
  providers: [AdminAccessibilityService, AdminAccessibilityRepository],
  exports: [AdminAccessibilityService],
})
export class AdminAccessibilityModule {}
