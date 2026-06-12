/**
 * PrivacyController — endpoints for LGPD data transparency and portability.
 *
 * Decision (GAP-04, dec-016): GET data-processing rate limited, Public.
 * Story 9-1: POST/GET export endpoints require authentication.
 * AuditInterceptor skips GET methods — no audit event generated for GET export.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  type DataProcessingRegistryResponse,
  PrivacyExportRequestSchema,
  type PrivacyExportJobResponse,
  type PrivacyExportStatus,
} from '@metanoia/types';
import { Public } from '../auth/decorators/public.decorator';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { PrivacyRateLimitGuard } from './privacy-rate-limit.guard';
import { PrivacyService } from './privacy.service';
import { PrivacyExportService } from './privacy-export.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { getRequestContext } from '../common/context/request-context';

@Controller('api/v1/privacy')
export class PrivacyController {
  constructor(
    private readonly privacyService: PrivacyService,
    private readonly privacyExportService: PrivacyExportService,
  ) {}

  /**
   * GET /api/v1/privacy/data-processing
   *
   * Returns all data processing operations registered under LGPD Art. 9º.
   * Public endpoint — no authentication required.
   * Rate limit: 30 req/min per IP (PrivacyRateLimitGuard).
   */
  @Public()
  @UseGuards(PrivacyRateLimitGuard)
  @Get('data-processing')
  async getDataProcessing(): Promise<DataProcessingRegistryResponse> {
    return this.privacyService.listDataProcessingRegistry();
  }

  /**
   * POST /api/v1/privacy/export
   *
   * Creates an async data export job (LGPD Art. 20).
   * Returns 202 Accepted with jobId for polling.
   * Returns 409 Conflict if an active job already exists.
   */
  @UseGuards(KeycloakAuthGuard)
  @Post('export')
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(PrivacyExportRequestSchema))
  async createExport(
    @Body() body: { format: 'json' | 'pdf' },
  ): Promise<{ data: PrivacyExportJobResponse }> {
    const { userId, tenantId } = getRequestContext();
    if (!userId) {
      throw new Error('userId required in RequestContext for export');
    }
    const result = await this.privacyExportService.createJob(userId, body.format, tenantId);
    return { data: result };
  }

  /**
   * GET /api/v1/privacy/export/:jobId
   *
   * Polls status of a data export job.
   * Returns 404 if jobId not found (expired or invalid).
   * signedUrl is null until status === 'completed'.
   */
  @UseGuards(KeycloakAuthGuard)
  @Get('export/:jobId')
  async getExportStatus(
    @Param('jobId') jobId: string,
  ): Promise<{ data: PrivacyExportStatus }> {
    const result = await this.privacyExportService.getJobStatus(jobId);
    return { data: result };
  }
}
