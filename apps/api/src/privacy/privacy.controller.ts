/**
 * PrivacyController — public endpoint exposing the data processing registry.
 *
 * Decision (GAP-04, dec-016): rate limited at 30 req/min via PrivacyRateLimitGuard.
 * No authentication guard — endpoint is @Public (LGPD Art. 9º transparency).
 * AuditInterceptor skips GET methods — no audit event generated (by design).
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import type { DataProcessingRegistryResponse } from '@metanoia/types';
import { Public } from '../auth/decorators/public.decorator';
import { PrivacyRateLimitGuard } from './privacy-rate-limit.guard';
import { PrivacyService } from './privacy.service';

@Controller('api/v1/privacy')
@UseGuards(PrivacyRateLimitGuard)
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  /**
   * GET /api/v1/privacy/data-processing
   *
   * Returns all data processing operations registered under LGPD Art. 9º.
   * Public endpoint — no authentication required.
   * Rate limit: 30 req/min per IP (PrivacyRateLimitGuard).
   */
  @Public()
  @Get('data-processing')
  async getDataProcessing(): Promise<DataProcessingRegistryResponse> {
    return this.privacyService.listDataProcessingRegistry();
  }
}
