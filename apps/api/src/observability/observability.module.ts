import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { ClientErrorRateLimitGuard } from './client-error-rate-limit.guard';

@Module({
  controllers: [ObservabilityController],
  providers: [ClientErrorRateLimitGuard],
})
export class ObservabilityModule {}
