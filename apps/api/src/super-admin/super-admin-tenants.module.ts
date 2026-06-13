import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { SuperAdminTenantsController } from './super-admin-tenants.controller';
import { SuperAdminTenantsService } from './super-admin-tenants.service';
import { SuperAdminTenantsRepository } from './super-admin-tenants.repository';

@Module({
  imports: [PrismaModule, OnboardingModule],
  controllers: [SuperAdminTenantsController],
  providers: [SuperAdminTenantsService, SuperAdminTenantsRepository],
  exports: [SuperAdminTenantsService],
})
export class SuperAdminTenantsModule {}
