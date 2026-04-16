import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { MarketingRateLimitGuard } from './rate-limit.guard';

@Module({
  controllers: [MarketingController],
  providers: [MarketingService, MarketingRateLimitGuard],
})
export class MarketingModule {}
