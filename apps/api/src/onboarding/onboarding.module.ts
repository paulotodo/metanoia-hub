import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingController } from './onboarding.controller';
import { DemoDataService } from './demo-data.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnboardingController],
  providers: [DemoDataService],
  exports: [DemoDataService],
})
export class OnboardingModule {}
