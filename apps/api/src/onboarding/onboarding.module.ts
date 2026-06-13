import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingController } from './onboarding.controller';
import { DemoDataService } from './demo-data.service';
import { OnboardingWizardService } from './onboarding-wizard.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnboardingController],
  providers: [DemoDataService, OnboardingWizardService],
  exports: [DemoDataService, OnboardingWizardService],
})
export class OnboardingModule {}
