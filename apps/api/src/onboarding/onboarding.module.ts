import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { DemoDataService } from './demo-data.service';

@Module({
  controllers: [OnboardingController],
  providers: [DemoDataService],
  exports: [DemoDataService],
})
export class OnboardingModule {}
