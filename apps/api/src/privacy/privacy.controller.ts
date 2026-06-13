/**
 * PrivacyController — endpoints for LGPD data transparency, portability, and deletion.
 *
 * Decision (GAP-04, dec-016): GET data-processing rate limited, Public.
 * Story 9-1: POST/GET export endpoints require authentication.
 * Story 9-2: POST/DELETE/GET deletion endpoints require authentication.
 * OWASP A01: DELETE/GET deletion always pass userId from RequestContext for ownership check.
 * AuditInterceptor skips GET methods — no audit event generated for GET export/deletion.
 */
import {
  Body,
  Controller,
  Delete,
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
  PrivacyDeletionRequestSchema,
  type PrivacyDeletionResponse,
  type PrivacyDeletionStatus,
} from '@metanoia/types';
import { Public } from '../auth/decorators/public.decorator';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { PrivacyRateLimitGuard } from './privacy-rate-limit.guard';
import { PrivacyService } from './privacy.service';
import { PrivacyExportService } from './privacy-export.service';
import { PrivacyDeletionService } from './privacy-deletion.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { getRequestContext } from '../common/context/request-context';

@Controller('api/v1/privacy')
export class PrivacyController {
  constructor(
    private readonly privacyService: PrivacyService,
    private readonly privacyExportService: PrivacyExportService,
    private readonly privacyDeletionService: PrivacyDeletionService,
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

  // ─── Deletion endpoints (Story 9-2) ───────────────────────────────────────────

  /**
   * POST /api/v1/privacy/deletion
   *
   * Creates an async deletion request (LGPD Art. 18 VI).
   * Requires body: { confirm: 'EXCLUIR' }.
   * Returns 202 Accepted with requestId.
   * Returns 409 Conflict if an active deletion request already exists (idempotent: returns same id).
   * Returns 422 LEADER_ACTIVE_GROUPS if user leads active groups.
   */
  @UseGuards(KeycloakAuthGuard)
  @Post('deletion')
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(PrivacyDeletionRequestSchema))
  async createDeletion(
    @Body() _body: { confirm: 'EXCLUIR' },
  ): Promise<{ data: PrivacyDeletionResponse }> {
    const { userId, tenantId } = getRequestContext();
    if (!userId) {
      throw new Error('userId required in RequestContext for deletion');
    }
    const result = await this.privacyDeletionService.createJob(userId, tenantId);
    return { data: result };
  }

  /**
   * DELETE /api/v1/privacy/deletion/:requestId
   *
   * Cancels a pending deletion request (within grace period).
   * OWASP A01: userId from RequestContext is passed for ownership check (not path-only).
   * Returns 204 No Content on success.
   * Returns 404 if not found or not owned by authenticated user.
   * Returns 409 if cancellation period has expired.
   */
  @UseGuards(KeycloakAuthGuard)
  @Delete('deletion/:requestId')
  @HttpCode(204)
  async cancelDeletion(@Param('requestId') requestId: string): Promise<void> {
    const { userId } = getRequestContext();
    if (!userId) {
      throw new Error('userId required in RequestContext for deletion cancel');
    }
    await this.privacyDeletionService.cancelRequest(requestId, userId);
  }

  /**
   * GET /api/v1/privacy/deletion/:requestId
   *
   * Returns current status of a deletion request.
   * OWASP A01: userId from RequestContext is passed for ownership check (not path-only).
   * Returns 404 if not found or not owned by authenticated user.
   */
  @UseGuards(KeycloakAuthGuard)
  @Get('deletion/:requestId')
  async getDeletionStatus(
    @Param('requestId') requestId: string,
  ): Promise<{ data: PrivacyDeletionStatus }> {
    const { userId } = getRequestContext();
    if (!userId) {
      throw new Error('userId required in RequestContext for deletion status');
    }
    const result = await this.privacyDeletionService.getStatus(requestId, userId);
    return { data: result };
  }
}
