import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TrailReportQuerySchema, type TrailReportQuery, LeaderSummaryQuerySchema, type LeaderSummaryQuery, TenantSummaryQuerySchema, type TenantSummaryQuery } from '@metanoia/types';
import { ReportsService } from './reports.service';
import { TenantReportService } from './tenant-report.service';
import { TenantReportRefreshService } from './tenant-report-refresh.service';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('Reports — Export Jobs')
@ApiBearerAuth()
@Controller('api/v1/reports')
@UseGuards(KeycloakAuthGuard, RolesGuard, TenantGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly tenantReportService: TenantReportService,
    private readonly tenantReportRefreshService: TenantReportRefreshService,
  ) {}

  /**
   * GET /api/v1/reports/trails
   * Returns summary of all trails in tenant (aggregate counts per trail).
   * Allowed for ADMIN_TENANT and LIDER: the "Relatórios → Trilhas" screen is
   * exposed to leaders in navigation, and the per-trail report/export endpoints
   * already allow LIDER. Data is tenant-scoped via RLS.
   */
  @Get('trails')
  @Roles(Role.ADMIN_TENANT, Role.LIDER)
  @HttpCode(HttpStatus.OK)
  async getTrailsSummary() {
    return this.reportsService.getTrailsSummary();
  }

  /**
   * GET /api/v1/reports/trails/:trailId
   * Leader: participants from their groups only.
   * Admin: all participants in tenant.
   */
  @Get('trails/:trailId')
  @Roles(Role.ADMIN_TENANT, Role.LIDER)
  @HttpCode(HttpStatus.OK)
  async getTrailReport(
    @Param('trailId') trailId: string,
    @Query(new ZodValidationPipe(TrailReportQuerySchema)) query: TrailReportQuery,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.reportsService.getTrailReport(trailId, query, req.user);
  }

  /**
   * GET /api/v1/reports/trails/:trailId/export?format=csv
   * Returns CSV inline or 202+jobId for large trails (>1000 participants).
   */
  @Get('trails/:trailId/export')
  @Roles(Role.ADMIN_TENANT, Role.LIDER)
  async exportTrailCsv(
    @Param('trailId') trailId: string,
    @Res() res: Response,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const result = await this.reportsService.exportTrailCsv(trailId, req.user);

    if (!result.inline) {
      res.status(HttpStatus.ACCEPTED).json({
        data: { jobId: result.jobId, message: 'Exportação em processamento. Consulte o status pelo jobId.' },
      });
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(HttpStatus.OK).send(result.csv);
  }

  /**
   * GET /api/v1/reports/jobs/:jobId
   * Poll export job status and retrieve signed URL when completed.
   *
   * CHK040: polling cadence — recommended minimum 3 seconds.
   * Backoff: 3s → 6s → 12s → max 30s. Max attempts: 20.
   * S1 mitigation: tenant+userId authorization enforced in service layer.
   */
  @Get('jobs/:jobId')
  @Roles(Role.ADMIN_TENANT, Role.LIDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Poll export job status',
    description:
      'Returns export job status (processing | completed | failed). ' +
      'On status=processing, Retry-After: 3 header is set (CHK040). ' +
      'S1 mitigation: tenant+userId authorization enforced in service layer.',
  })
  @ApiOkResponse({ description: 'Export job status with optional signedUrl when completed' })
  @ApiForbiddenResponse({ description: 'Unauthorized or cross-tenant access attempt' })
  @ApiNotFoundResponse({ description: 'Job not found or access denied (intentionally ambiguous — CHK035)' })
  async getJobStatus(
    @Param('jobId') jobId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const status = await this.reportsService.getJobStatus(jobId);
    // CHK040: instruct client to wait at least 3s before next poll
    if (status.status === 'processing') {
      res.setHeader('Retry-After', '3');
    }
    return { data: status };
  }
  /**
   * GET /api/v1/reports/leader-summary
   * Consolidated metrics across groups led by the authenticated user (FR79).
   * groupId is a filter within the leader universe (BOLA: out-of-universe group
   * returns empty array, not 403).
   */
  @Get('leader-summary')
  @Roles(Role.LIDER, Role.ADMIN_TENANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consolidated leader summary (FR79)',
    description:
      'Returns aggregated metrics across all groups led by the authenticated user. ' +
      'groupId is a filter within the leader universe (BOLA: out-of-universe group returns empty array, not 403).',
  })
  @ApiOkResponse({ description: 'Leader summary with groups array and overall metrics' })
  @ApiBadRequestResponse({ description: 'Invalid query params (e.g. period=custom without dates)' })
  @ApiForbiddenResponse({ description: 'Role LIDER or ADMIN_TENANT required' })
  async getLeaderSummary(
    @Query(new ZodValidationPipe(LeaderSummaryQuerySchema)) query: LeaderSummaryQuery,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.reportsService.getLeaderSummary(query, req.user);
  }

  /**
   * GET /api/v1/reports/tenant-summary
   * Admin: resumo consolidado por grupo da MV mv_tenant_report (FR65).
   */
  @Get('tenant-summary')
  @Roles(Role.ADMIN_TENANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tenant summary from Materialized View (FR65)',
    description:
      'Returns consolidated per-group metrics from mv_tenant_report. ' +
      'Tenant isolation via explicit WHERE tenant_id filter (AC-SEC-01). ' +
      'last_refresh_at and stale flag in meta.',
  })
  @ApiOkResponse({ description: 'Groups array + overall metrics + refresh meta' })
  @ApiForbiddenResponse({ description: 'Role ADMIN_TENANT required' })
  async getTenantSummary(
    @Query(new ZodValidationPipe(TenantSummaryQuerySchema)) query: TenantSummaryQuery,
  ) {
    return this.tenantReportService.getTenantSummary(query);
  }

  /**
   * POST /api/v1/reports/tenant-summary/refresh
   * Admin: dispara refresh on-demand da MV (rate-limited 1/5min/tenant).
   */
  @Post('tenant-summary/refresh')
  @Roles(Role.ADMIN_TENANT)
  @ApiOperation({
    summary: 'Trigger on-demand MV refresh (AC-SEC-05)',
    description:
      'Rate-limited: 1 request per tenant per 5 minutes (Redis SET NX). ' +
      'Returns 202 Accepted or 429 Too Many Requests with retryAfter.',
  })
  @ApiOkResponse({ description: '202 Accepted or 429 rate-limited' })
  @ApiForbiddenResponse({ description: 'Role ADMIN_TENANT required' })
  async refreshTenantSummary(@Res() res: import('express').Response) {
    const result = await this.tenantReportRefreshService.requestRefresh();
    res.status(result.status).json(result.body);
  }


}