import {
  Controller,
  Get,
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
import { TrailReportQuerySchema, type TrailReportQuery } from '@metanoia/types';
import { ReportsService } from './reports.service';
import {
  ApiBearerAuth,
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
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/v1/reports/trails
   * Admin: returns summary of all trails in tenant.
   */
  @Get('trails')
  @Roles(Role.ADMIN_TENANT)
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
}
